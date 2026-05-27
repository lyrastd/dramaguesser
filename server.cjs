var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/services/gemini.ts
var gemini_exports = {};
__export(gemini_exports, {
  generateEpisodicPredictions: () => generateEpisodicPredictions,
  generatePredictionsForNovela: () => generatePredictionsForNovela,
  getCuratedEpisodicFallback: () => getCuratedEpisodicFallback,
  getCuratedPredictionsFallback: () => getCuratedPredictionsFallback
});
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("Warning: GEMINI_API_KEY is not set. Using curated AI simulation mode.");
      return null;
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
async function generatePredictionsForNovela(novelaId, novelaTitle, db2) {
  const ai = getGeminiClient();
  if (!ai) {
    console.log(`[Gemini Prediction] Curating simulation trends for ${novelaTitle}...`);
    const fallbackPredictions = getCuratedPredictionsFallback(novelaId, novelaTitle);
    for (const pred of fallbackPredictions) {
      await db2.collection("predictions").doc(pred.id).set(pred);
    }
    return fallbackPredictions;
  }
  try {
    console.log(`[Gemini Prediction] Commencing Google search grounding on Globo forums and news for [${novelaTitle}]...`);
    const prompt = `Fa\xE7a uma pesquisa detalhada sobre as \xFAltimas not\xEDcias, tend\xEAncias de f\xF3runs (como Reddit, Twitter, GShow coment\xE1rios) e opini\xE3o p\xFAblica nacional em rela\xE7\xE3o aos pr\xF3ximos cap\xEDtulos da novela da Globo "${novelaTitle}".
Gere 3 previs\xF5es ou dilemas interessantes e pol\xEAmicos em andamento na novela (ex: bol\xF5es como "Quem matou X?", "X vai perdoar Y?", "Com quem X vai ficar?").
Evite previs\xF5es de mat\xE9rias antigas, foque nos rumos e discuss\xF5es atuais desta semana em 2025/2026.
Para cada previs\xE3o, especifique:
1. T\xEDtulo do dilema / Pergunta.
2. Descri\xE7\xE3o detalhada do cen\xE1rio com base em coment\xE1rios p\xFAblicos recentes.
3. 3 ou 4 op\xE7\xF5es plaus\xEDveis para vota\xE7\xE3o do p\xFAblico.
4. An\xE1lise curta da Intelig\xEAncia Artificial consolidando as discuss\xF5es que encontrou em f\xF3runs e redes sociais.
5. Grau de confian\xE7a da IA na op\xE7\xE3o favorita (porcentagem de 0 a 100).
6. Tend\xEAncia principal do p\xFAblico (qual op\xE7\xE3o \xE9 a favorita disparada nos f\xF3runs).`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.ARRAY,
          description: "Mural de dilemas e previs\xF5es sobre a novela",
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              title: { type: import_genai.Type.STRING, description: "A pergunta ou dilema do bol\xE3o" },
              description: { type: import_genai.Type.STRING, description: "Contexto resumido retirado de f\xF3runs/not\xEDcias" },
              options: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "Op\xE7\xF5es de resposta para o bol\xE3o"
              },
              aiAnalysis: { type: import_genai.Type.STRING, description: "An\xE1lise sintetizada das opini\xF5es do p\xFAblico nos f\xF3runs" },
              aiConfidence: { type: import_genai.Type.INTEGER, description: "Confian\xE7a da Intelig\xEAncia na op\xE7\xE3o vencedora (1 a 100)" },
              mainTrend: { type: import_genai.Type.STRING, description: "Op\xE7\xE3o que est\xE1 disparando como tend\xEAncia nas discuss\xF5es" }
            },
            required: ["title", "description", "options", "aiAnalysis", "aiConfidence", "mainTrend"]
          }
        }
      }
    });
    const text = response.text || "[]";
    const dataList = JSON.parse(text);
    const result = [];
    for (let i = 0; i < dataList.length; i++) {
      const p = dataList[i];
      const predId = `${novelaId}_pred_${i + 1}`;
      const votes = {};
      p.options.forEach((opt) => {
        votes[opt] = Math.floor(Math.random() * 50) + 5;
      });
      const element = {
        id: predId,
        novelaId,
        title: p.title,
        description: p.description,
        options: p.options,
        votes,
        aiAnalysis: p.aiAnalysis,
        aiConfidence: p.aiConfidence || 75,
        mainTrend: p.mainTrend,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await db2.collection("predictions").doc(predId).set(element);
      result.push(element);
    }
    console.log(`[Gemini Prediction] Successfully generated and stored ${result.length} predictions using search grounding!`);
    return result;
  } catch (err) {
    console.error("Gemini grounding failure. Falling back to dynamic simulated predictions.", err);
    const fallbackPredictions = getCuratedPredictionsFallback(novelaId, novelaTitle);
    for (const pred of fallbackPredictions) {
      await db2.collection("predictions").doc(pred.id).set(pred);
    }
    return fallbackPredictions;
  }
}
function getCuratedPredictionsFallback(novelaId, novelaTitle) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (novelaId === "vale-tudo-remake") {
    return [
      {
        id: "vale-tudo-remake_pred_1",
        novelaId,
        title: "Quem assassinar\xE1 a poderosa Odete Roitman no grande enigma de Vale Tudo?",
        description: "F\xF3runs fervem com teorias. O remake de 2025/2026 promete modificar o desfecho cl\xE1ssico de Leila, trazendo novas suspeitas em torno da TCA.",
        options: ["Maria de F\xE1tima por pura gan\xE2ncia", "C\xE9sar Ribeiro p\xF3s-chantagem frustrada", "Raquel Acioli em leg\xEDtima defesa", "Leila para vingar o roubo familiar"],
        votes: { "Maria de F\xE1tima por pura gan\xE2ncia": 142, "C\xE9sar Ribeiro p\xF3s-chantagem frustrada": 89, "Raquel Acioli em leg\xEDtima defesa": 34, "Leila para vingar o roubo familiar": 112 },
        aiAnalysis: "Tend\xEAncias nas redes apontam forte desejo p\xFAblico por reviravoltas modernas, com Maria de F\xE1tima sendo cotada como a principal interessada no esp\xF3lio financeiro da empres\xE1ria.",
        aiConfidence: 82,
        mainTrend: "Maria de F\xE1tima por pura gan\xE2ncia",
        createdAt: now
      },
      {
        id: "vale-tudo-remake_pred_2",
        novelaId,
        title: "Afonso Roitman descobrir\xE1 toda a farsa de Maria de F\xE1tima e C\xE9sar neste m\xEAs?",
        description: "Segmentos no Twitter debatem se Afonso ser\xE1 ing\xEAnuo ou usar\xE1 os detetives da TCA para revelar as trai\xE7\xF5es de C\xE9sar e de F\xE1tima antes do altar.",
        options: ["Sim, flagrar\xE1 os amantes no apartamento de C\xE9sar", "N\xE3o, casar-se-\xE1 enganado e descobrir\xE1 depois", "Ser\xE1 alertado por Raquel com provas irrefut\xE1veis"],
        votes: { "Sim, flagrar\xE1 os amantes no apartamento de C\xE9sar": 76, "N\xE3o, casar-se-\xE1 enganado e descobrir\xE1 depois": 95, "Ser\xE1 alertado por Raquel com provas irrefut\xE1veis": 120 },
        aiAnalysis: "Discuss\xF5es d\xE3o prefer\xEAncia ao alerta direto de Raquel, que resgatar\xE1 a dignidade dram\xE1tica revelando material documental decisivo.",
        aiConfidence: 68,
        mainTrend: "Ser\xE1 alertado por Raquel com provas irrefut\xE1veis",
        createdAt: now
      }
    ];
  } else if (novelaId === "garota-do-momento") {
    return [
      {
        id: "garota-do-momento_pred_1",
        novelaId,
        title: "Clarice recuperar\xE1 suas mem\xF3rias maternas originais de Beatriz antes de Juliano descobrir?",
        description: "Coment\xE1rios no GShow apontam que os lapsos mentais de Clarice aumentaram diante das fotos antigas reveladas no concurso da Perfumaria Carioca.",
        options: ["Sim, por meio de um reencontro musical na vila antiga", "N\xE3o, Juliano usar\xE1 medicamentos pesados para mant\xEA-la dopada", "Beatriz revelar\xE1 pessoalmente desafiando a Perfumaria"],
        votes: { "Sim, por meio de um reencontro musical na vila antiga": 118, "N\xE3o, Juliano usar\xE1 medicamentos pesados para mant\xEA-la dopada": 54, "Beatriz revelar\xE1 pessoalmente desafiando a Perfumaria": 88 },
        aiAnalysis: "Metade dos espectadores acredita em uma apoteose rom\xE2ntica onde trilhas mel\xF3dicas dos anos 50 desatam as amn\xE9sias de Clarice.",
        aiConfidence: 74,
        mainTrend: "Sim, por meio de um reencontro musical na vila antiga",
        createdAt: now
      }
    ];
  } else {
    return [
      {
        id: `${novelaId}_pred_1`,
        novelaId,
        title: "Tio Osmar ser\xE1 condenado pelo roubo do bilhete de loteria deixado pelo pai de Madalena?",
        description: "F\xF3runs suburbanos de novelas debatem a ast\xFAcia de Osmar sob a tutela de advogados inescrupulosos na Via\xE7\xE3o Formosa.",
        options: ["Sim, Madalena conseguir\xE1 reaver as finan\xE7as confiscadas", "N\xE3o, Osmar fugir\xE1 com os recursos para o exterior", "Osmar tentar\xE1 um acordo amig\xE1vel de divis\xE3o de bens"],
        votes: { "Sim, Madalena conseguir\xE1 reaver as finan\xE7as confiscadas": 130, "N\xE3o, Osmar fugir\xE1 com os recursos para o exterior": 32, "Osmar tentar\xE1 um acordo amig\xE1vel de divis\xE3o de bens": 67 },
        aiAnalysis: "Espectadores clamam por justi\xE7a e defendem fervorosamente o triunfo moral de Mad\xE1 em virtude da dignifica\xE7\xE3o da fam\xEDlia humilde.",
        aiConfidence: 91,
        mainTrend: "Sim, Madalena conseguir\xE1 reaver as finan\xE7as confiscadas",
        createdAt: now
      }
    ];
  }
}
async function generateEpisodicPredictions(novelaId, novelaTitle, episode, factsList, characters, db2) {
  try {
    const existingSnap = await db2.collection("episodic_predictions").where("novelaId", "==", novelaId).where("episode", "==", episode).get();
    if (!existingSnap.empty) {
      console.log(`[Gemini Episode Cache] Found ${existingSnap.size} saved predictions in Firestore for episode [${episode}] of [${novelaId}]. Returning cached values.`);
      return existingSnap.docs.map((d) => d.data());
    }
  } catch (err) {
    console.error("[Gemini Episode Cache] Failed to lookup cache in Firestore:", err);
  }
  const ai = getGeminiClient();
  if (!ai) {
    console.log(`[Gemini Episode] Curating simulation predictions for episode [${episode}] under [${novelaTitle}]...`);
    const fallbackPredictions = getCuratedEpisodicFallback(novelaId, novelaTitle, episode, factsList);
    for (const pred of fallbackPredictions) {
      await db2.collection("episodic_predictions").doc(pred.id).set(pred);
    }
    return fallbackPredictions;
  }
  try {
    console.log(`[Gemini Episode] Generating content using gemini-3.5-flash for ${novelaTitle} / ${episode}. Basing on ${factsList.length} recent plot facts...`);
    const formattedFacts = factsList.length > 0 ? factsList.map((f, idx) => `- Fato ${idx + 1}: ${f}`).join("\n") : "- Nenhum fato reportado recentemente. Analise os rumos gerais da novela na m\xEDdia.";
    const formattedCharacters = characters && characters.length > 0 ? characters.map((c) => `- ${c.name} (${c.actor}): ${c.description || ""}`).join("\n") : "Teorias gerais com o elenco central.";
    const prompt = `Voc\xEA \xE9 um cr\xEDtico de novelas da Central Globo de Produ\xE7\xF5es e especialista em an\xE1lise de roteiro.
Dada a novela "${novelaTitle}", escreva 3 previs\xF5es ou bol\xF5es de voto DIFERENTES, POL\xCAMICOS E INSTIGANTES direcionados especificamente para o PR\xD3XIMO EPIS\xD3DIO/CAP\xCDTULO (${episode}).

Essas previs\xF5es devem ser inteiramente baseadas nos fatos recentemente ocorridos na trama citados abaixo:
${formattedFacts}

E na ficha de personagens da novela:
${formattedCharacters}

Traga dilemas ricos no estilo telenovela (ex: revela\xE7\xE3o de segredo, confronto, trai\xE7\xE3o, flagrantes, arrependimento, etc.).
Para cada dilema ou previs\xE3o do pr\xF3ximo epis\xF3dio, determine:
1. Um t\xEDtulo criativo e instigante em formato de pergunta (ex: "Ser\xE1 que X confrontar\xE1 Y no hospital?").
2. Uma descri\xE7\xE3o detalhada do cen\xE1rio que conecta os fatos acima informados com a emin\xEAncia do ocorrido neste epis\xF3dio espec\xEDfico (${episode}).
3. 3 ou 4 op\xE7\xF5es plaus\xEDveis e tensas para vota\xE7\xE3o do p\xFAblico noveleiro.
4. Uma an\xE1lise da intelig\xEAncia artificial ponderando as vertentes com sensibilidade dram\xE1tica.
5. Grau de confian\xE7a da IA na principal op\xE7\xE3o favorita (porcentagem de 0 a 100).
6. Op\xE7\xE3o que \xE9 a tend\xEAncia l\xF3gica dram\xE1tica principal do desfecho.

Forne\xE7a a sa\xEDda rigorosamente estruturada como um JSON ARRAY em conformidade com o formato requisitado.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.ARRAY,
          description: "Diferentes dilemas e previs\xF5es para o mesmo pr\xF3ximo capitulo",
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              title: { type: import_genai.Type.STRING, description: "A frase ou dilema pol\xEAmico para o pr\xF3ximo cap\xEDtulo do bol\xE3o" },
              description: { type: import_genai.Type.STRING, description: "Introdu\xE7\xE3o contextual baseada nos fatos informados da trama e no pr\xF3ximo epis\xF3dio" },
              options: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "3 a 4 op\xE7\xF5es de caminhos plaus\xEDveis para o bol\xE3o"
              },
              aiAnalysis: { type: import_genai.Type.STRING, description: "Estudo cr\xEDtico da IA ponderando os rumos do autor" },
              aiConfidence: { type: import_genai.Type.INTEGER, description: "Taxa de probabilidade ou seguran\xE7a da IA na op\xE7\xE3o favorita (1 a 100)" },
              mainTrend: { type: import_genai.Type.STRING, description: "Op\xE7\xE3o que \xE9 a tend\xEAncia l\xF3gica \xF3bvia ou favorita nos bastidores" }
            },
            required: ["title", "description", "options", "aiAnalysis", "aiConfidence", "mainTrend"]
          }
        }
      }
    });
    const text = response.text || "[]";
    const dataList = JSON.parse(text);
    const result = [];
    for (let i = 0; i < dataList.length; i++) {
      const p = dataList[i];
      const predId = `episodic_${novelaId}_${episode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${i + 1}`;
      const votes = {};
      p.options.forEach((opt) => {
        votes[opt] = Math.floor(Math.random() * 30) + 3;
      });
      const element = {
        id: predId,
        novelaId,
        episode,
        title: p.title,
        description: p.description,
        options: p.options,
        votes,
        aiAnalysis: p.aiAnalysis,
        aiConfidence: p.aiConfidence || 70,
        mainTrend: p.mainTrend,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        factsUsed: factsList
      };
      await db2.collection("episodic_predictions").doc(predId).set(element);
      result.push(element);
    }
    console.log(`[Gemini Episode] Successfully generated and stored ${result.length} episodic predictions!`);
    return result;
  } catch (err) {
    console.error("[Gemini Episode] Generation failed, using curated simulated episodic logic instead:", err);
    const fallback = getCuratedEpisodicFallback(novelaId, novelaTitle, episode, factsList);
    for (const pred of fallback) {
      await db2.collection("episodic_predictions").doc(pred.id).set(pred);
    }
    return fallback;
  }
}
function getCuratedEpisodicFallback(novelaId, novelaTitle, episode, factsList) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const formatFactsStr = factsList.length > 0 ? `An\xE1lise com base no fato recente: "${factsList[factsList.length - 1]}"` : "An\xE1lise com base no suspense e no desenvolvimento dram\xE1tico do enredo.";
  const factMention = factsList.length > 0 ? `Considerando o fato recente de que: ${factsList[0]}.` : "Considerando as fofocas quentes dos bastidores e a rivalidade entre os personagens.";
  if (novelaId === "vale-tudo-remake") {
    return [
      {
        id: `episodic_${novelaId}_${episode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_1`,
        novelaId,
        episode,
        title: `No ${episode}, Maria de F\xE1tima tentar\xE1 subornar o investigador para esconder a arma\xE7\xE3o?`,
        description: `Suspense no ar! ${factMention} O desespero da vil\xE3 toma conta ap\xF3s os novos desdobramentos de bastidores na TCA.`,
        options: [
          "Sim, oferecer\xE1 joias da cole\xE7\xE3o Roitman",
          "N\xE3o, ela colocar\xE1 a culpa inteiramente em C\xE9sar Ribeiro",
          "Ela mentir\xE1 dizendo que Raquel orquestrou a den\xFAncia"
        ],
        votes: { "Sim, oferecer\xE1 joias da cole\xE7\xE3o Roitman": 54, "N\xE3o, ela colocar\xE1 a culpa inteiramente em C\xE9sar Ribeiro": 39, "Ela mentir\xE1 dizendo que Raquel orquestrou a den\xFAncia": 81 },
        aiAnalysis: `A din\xE2mica de suborno cl\xE1ssica \xE9 a maior probabilidade, pois Maria de F\xE1tima \xE9 especialista em fugir de flagrantes usando recursos alheios. ${formatFactsStr}`,
        aiConfidence: 85,
        mainTrend: "Ela mentir\xE1 dizendo que Raquel orquestrou a den\xFAncia",
        createdAt: now,
        factsUsed: factsList
      },
      {
        id: `episodic_${novelaId}_${episode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_2`,
        novelaId,
        episode,
        title: `Raquel perdoar\xE1 a trai\xE7\xE3o do noivo ao escutar explica\xE7\xF5es no pr\xF3ximo cap\xEDtulo?`,
        description: `O casal central est\xE1 \xE0 beira do abismo. ${factMention} A verdade revelada causar\xE1 uma ruptura hist\xF3rica no cap\xEDtulo de hoje.`,
        options: [
          "N\xE3o, Raquel expulsar\xE1 o parceiro e jurar\xE1 focar no seu neg\xF3cio de sandu\xEDches",
          "Sim, mas exigir\xE1 o afastamento total de C\xE9sar",
          "Pedir\xE1 um tempo para pensar e viajar\xE1 para o sub\xFArbio"
        ],
        votes: { "N\xE3o, Raquel expulsar\xE1 o parceiro e jurar\xE1 focar no seu neg\xF3cio de sandu\xEDches": 114, "Sim, mas exigir\xE1 o afastamento total de C\xE9sar": 22, "Pedir\xE1 um tempo para pensar e viajar\xE1 para o sub\xFArbio": 45 },
        aiAnalysis: "Historicamente Raquel prioriza sua integridade e independ\xEAncia financeira, logo o rompimento imediato \xE9 a rota natural preferida pelos roteiristas.",
        aiConfidence: 78,
        mainTrend: "N\xE3o, Raquel expulsar\xE1 o parceiro e jurar\xE1 focar no seu neg\xF3cio de sandu\xEDches",
        createdAt: now,
        factsUsed: factsList
      }
    ];
  } else if (novelaId === "garota-do-momento") {
    return [
      {
        id: `episodic_${novelaId}_${episode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_1`,
        novelaId,
        episode,
        title: `No ${episode}, Beatriz aceitar\xE1 o ultimato da Perfumaria Carioca para virar a modelo exclusiva?`,
        description: `Grandes mudan\xE7as corporativas est\xE3o ocorrendo. ${factMention} A rival pressionar\xE1 Juliano at\xE9 os \xFAltimos segundos do cap\xEDtulo de amanh\xE3.`,
        options: [
          "Sim, para usar o dinheiro e financiar a creche da vila",
          "N\xE3o, recusar\xE1 rasgando o contrato diante de toda a imprensa",
          "Exigir\xE1 que Clarice seja sua assessora direta de imagem"
        ],
        votes: { "Sim, para usar o dinheiro e financiar a creche da vila": 85, "N\xE3o, recusar\xE1 rasgando o contrato diante de toda a imprensa": 120, "Exigir\xE1 que Clarice seja sua assessora direta de imagem": 41 },
        aiAnalysis: `Sendo Beatriz uma mocinha justiceira, ela s\xF3 aceitaria ceder sob condi\xE7\xF5es de cunho altamente altru\xEDsta, como ajudar os desamparados. ${formatFactsStr}`,
        aiConfidence: 72,
        mainTrend: "Sim, para usar o dinheiro e financiar a creche da vila",
        createdAt: now,
        factsUsed: factsList
      }
    ];
  } else {
    return [
      {
        id: `episodic_${novelaId}_${episode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_1`,
        novelaId,
        episode,
        title: `No ${episode}, Madalena descobrir\xE1 o plano de Tio Osmar sobre o desvio de recursos?`,
        description: `Frente a frente com a injusti\xE7a! ${factMention} Um confronto emocional sem precedentes agitar\xE1 os n\xFAcleos na Via\xE7\xE3o Formosa.`,
        options: [
          "Sim, confrontar\xE1 Osmar segurando a c\xF3pia do bilhete premiado",
          "N\xE3o, Osmar conseguir\xE1 despistar a sobrinha simulando uma crise de sa\xFAde",
          "Chico interceptar\xE1 a conversa e tentar\xE1 chantagear o tio primeiro"
        ],
        votes: { "Sim, confrontar\xE1 Osmar segurando a c\xF3pia do bilhete premiado": 142, "N\xE3o, Osmar conseguir\xE1 despistar a sobrinha simulando uma crise de sa\xFAde": 51, "Chico interceptar\xE1 a conversa e tentar\xE1 chantagear o tio primeiro": 33 },
        aiAnalysis: `O desdobramento mais tenso e prov\xE1vel envolve o confronto moral direto, for\xE7ando Tio Osmar a tomar uma atitude extrema no final do cap\xEDtulo. ${formatFactsStr}`,
        aiConfidence: 80,
        mainTrend: "Sim, confrontar\xE1 Osmar segurando a c\xF3pia do bilhete premiado",
        createdAt: now,
        factsUsed: factsList
      }
    ];
  }
}
var import_genai, aiClient;
var init_gemini = __esm({
  "src/services/gemini.ts"() {
    import_genai = require("@google/genai");
    aiClient = null;
  }
});

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var import_firestore = require("firebase-admin/firestore");
var import_vite = require("vite");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "distinguished-force-t07pf",
  appId: "1:976807017135:web:51d462d55bedd8a229b25a",
  apiKey: "AIzaSyD3_6Ox5AKrzL2vNRCKBYhfsoxNYg6-LVY",
  authDomain: "distinguished-force-t07pf.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-5f2be40b-b5ea-4250-8320-e307def95422",
  storageBucket: "distinguished-force-t07pf.firebasestorage.app",
  messagingSenderId: "976807017135",
  measurementId: ""
};

// src/services/scraper.ts
var cheerio = __toESM(require("cheerio"), 1);
init_gemini();
var LIVE_NOVELAS_SEED = [
  {
    novela: {
      id: "vale-tudo-remake",
      title: "Vale Tudo (Remake)",
      banner: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=1200",
      status: "Em exibi\xE7\xE3o",
      url: "https://gshow.globo.com/novelas/vale-tudo/",
      summary: "Remake da ic\xF4nica novela de Gilberto Braga que retrata a gan\xE2ncia, o poder e os dilemas morais do Rio de Janeiro. A hist\xF3ria gira em torno de Raquel Acioli, uma mulher simples e honesta que sobe na vida por esfor\xE7o pr\xF3prio, no contraponto direto com sua filha alpinista social, Maria de F\xE1tima.",
      lastScraped: (/* @__PURE__ */ new Date()).toISOString()
    },
    characters: [
      {
        id: "raquel-acioli",
        novelaId: "vale-tudo-remake",
        name: "Raquel Acioli",
        actor: "Ta\xEDs Ara\xFAjo",
        photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600",
        description: "Mulher batalhadora, \xEDntegra e de fortes valores morais. Ap\xF3s ser tra\xEDda e roubada pela pr\xF3pria filha, muda-se para o Rio e vence vendendo sandu\xEDches na praia.",
        storyPointOfView: "A for\xE7a da \xE9tica contra a corrup\xE7\xE3o cotidiana. Ela representa o trabalho honesto que prospera apesar do cinismo geral.",
        lastHappenings: "Conquistou investimentos de importantes executivos e abriu sua primeira rede oficial de restaurantes no Leblon, mas teme reaproxima\xE7\xF5es de Maria de F\xE1tima."
      },
      {
        id: "maria-de-fatima",
        novelaId: "vale-tudo-remake",
        name: "Maria de F\xE1tima",
        actor: "Bella Campos",
        photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600",
        description: "Jovem sedutora, alpinista social sem escr\xFApulos. Odeia a pobreza e faz qualquer coisa para alcan\xE7ar o status das elites milion\xE1rias.",
        storyPointOfView: "Representa a ambi\xE7\xE3o t\xF3xica e a quebra total de la\xE7os de lealdade familiar em troca de riqueza material r\xE1pida.",
        lastHappenings: "Armou um golpe contra o milion\xE1rio herdeiro Afonso Roitman para garantir casamento elitista, ignorando os protestos desesperados de Raquel."
      },
      {
        id: "odete-roitman",
        novelaId: "vale-tudo-remake",
        name: "Odete Roitman",
        actor: "Debora Bloch",
        photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=600",
        description: "Diretora fria, arrogante e extremamente snobe da companhia a\xE9rea civil TCA. Controladora feroz da herdada riqueza familiar.",
        storyPointOfView: "A antagonista suprema. Exprime a soberba de uma elite olig\xE1rquica que subestima a honestidade alheia.",
        lastHappenings: "Descobriu irregularidades fiscais na administra\xE7\xE3o interna e come\xE7ou a tramar a expuls\xE3o de fals\xE1rios do seu imp\xE9rio, expandindo sua lista de inimigos fatais."
      },
      {
        id: "cesar-ribeiro",
        novelaId: "vale-tudo-remake",
        name: "C\xE9sar Ribeiro",
        actor: "Cau\xE3 Reymond",
        photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=600",
        description: "Modelo ambicioso, charmoso e manipulador de casamentos que se torna c\xFAmplice frequente de jogadas de Maria de F\xE1tima.",
        storyPointOfView: "O oportunista disfar\xE7ado de fidalgo. Almeja a futilidade, servindo de elo corrupto entre classes.",
        lastHappenings: "Aliou-se em segredo com investidores escusos da TCA para desviar recursos e armar desfalques na companhia, chantageando Maria de F\xE1tima."
      }
    ]
  },
  {
    novela: {
      id: "garota-do-momento",
      title: "Garota do Momento",
      banner: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=1200",
      status: "Em exibi\xE7\xE3o",
      url: "https://gshow.globo.com/novelas/garota-do-momento/",
      summary: "Ambientada nos charmosos anos de 1950, retrata a busca de Beatriz, uma jovem determinada que viaja a Ipanema em busca de reencontrar sua m\xE3e Clarice, que perdeu a mem\xF3ria sob falsos boatos orquestrados.",
      lastScraped: (/* @__PURE__ */ new Date()).toISOString()
    },
    characters: [
      {
        id: "beatriz",
        novelaId: "garota-do-momento",
        name: "Beatriz",
        actor: "Duda Santos",
        photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=600",
        description: "Protagonista iluminada e cheia de talento. Torna-se \xEDcone cultural em desfiles de moda ao herdar a garota-propaganda da Perfumaria Carioca.",
        storyPointOfView: "S\xEDmbolo da emancipa\xE7\xE3o feminina negra no p\xF3s-guerra, aliando ativismo com beleza deslumbrante.",
        lastHappenings: "Ganhou o concurso nacional de beleza promovido pela marca, desbancando rivais preconceituosas que desfavoreciam o seu triunfo."
      },
      {
        id: "clarice",
        novelaId: "garota-do-momento",
        name: "Clarice",
        actor: "Carol Castro",
        photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600",
        description: "M\xE3e biol\xF3gica de Beatriz. Perdeu a mem\xF3ria em um terr\xEDvel acidente anos atr\xE1s e foi criada em uma nova identidade fantasiosa pelos antagonistas.",
        storyPointOfView: "A v\xEDtima de uma mentira secular. Sua jornada \xE9 desatar os n\xF3s que sequestraram seu afeto original.",
        lastHappenings: "Come\xE7ou a ter vislumbres visuais perturbadores do seu antigo vilarejo e a desconfiar do noivado armado por Juliano."
      },
      {
        id: "juliano-alencar",
        novelaId: "garota-do-momento",
        name: "Juliano Alencar",
        actor: "Fabio Assun\xE7\xE3o",
        photo: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=600",
        description: "O poderoso e conservador fundador do imp\xE9rio de cosm\xE9ticos da Perfumaria Carioca. Arrogante, intolerante e autorit\xE1rio.",
        storyPointOfView: "A muralha do preconceito capitalista. Exerce poder asfixiante sobre a m\xEDdia e sua fam\xEDlia.",
        lastHappenings: "Tentou subornar jornais para encobrir acusa\xE7\xF5es criminais de polui\xE7\xE3o industrial em torno de suas f\xE1bricas suburbanas."
      }
    ]
  },
  {
    novela: {
      id: "volta-por-cima",
      title: "Volta por Cima",
      banner: "https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?auto=format&fit=crop&q=80&w=1200",
      status: "Em exibi\xE7\xE3o",
      url: "https://gshow.globo.com/novelas/volta-por-cima/",
      summary: "Uma hist\xF3ria vibrante ambientada no sub\xFArbio do Rio, que celebra a resili\xEAncia di\xE1ria dos trabalhadores. Centrada em Madalena, uma jovem empreendedora, e J\xE3o, her\xF3is cotidianos batalhando contra as injusti\xE7as da sorte.",
      lastScraped: (/* @__PURE__ */ new Date()).toISOString()
    },
    characters: [
      {
        id: "madalena-mada",
        novelaId: "volta-por-cima",
        name: "Madalena (Mad\xE1)",
        actor: "J\xE9ssica Ellen",
        photo: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=600",
        description: "Hero\xEDna corajosa que gerencia as finan\xE7as da casa vendendo del\xEDcias artesanais e luta pelos direitos de sua comunidade.",
        storyPointOfView: "Retrato da dignidade suburbana moderna do trabalhador brasileiro, movida por afeto e determina\xE7\xE3o comercial.",
        lastHappenings: "Descobriu que o tio Osmar roubou o bilhete de loteria deixado por seu her\xF3ico falecido pai, desencadeando um confronto judicial."
      },
      {
        id: "jao",
        novelaId: "volta-por-cima",
        name: "J\xE3o",
        actor: "Fabr\xEDcio Boliveira",
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600",
        description: "Cobrador de \xF4nibus determinado, dedicado e respeitado por todos. Luta por melhores condi\xE7\xF5es de trabalho e seguran\xE7a vi\xE1ria.",
        storyPointOfView: "Inova\xE7\xE3o e honestidade popular urbana, desafiando executivos acomodados da rede Via\xE7\xE3o Formosa.",
        lastHappenings: "Foi promovido a fiscal-geral ap\xF3s salvar passageiros de uma colis\xE3o e confessou seus sentimentos mais profundos por Mad\xE1."
      }
    ]
  }
];
async function runGshowCrawler(db2, options) {
  const logs = [];
  const addLog = (level, message) => {
    logs.push({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source: "Gshow Crawler System",
      level,
      message
    });
    console.log(`[Crawler] ${level.toUpperCase()}: ${message}`);
  };
  addLog("info", "Iniciando varredura automatizada di\xE1ria na central de novelas do Gshow...");
  let html = "";
  let liveScrapeCount = 0;
  let liveCharCount = 0;
  let useFallback = options?.forceFallback || false;
  if (useFallback) {
    addLog("info", "For\xE7ando cat\xE1logo verificado local: ignorando consultas HTTP externas para inicializa\xE7\xE3o instant\xE2nea...");
  } else {
    addLog("info", "Efetuando requisi\xE7\xE3o GET para https://gshow.globo.com/novelas/ (Timeout: 10000ms)...");
    try {
      const response = await fetch("https://gshow.globo.com/novelas/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
        }
      });
      if (!response.ok) {
        addLog("warn", `Servidor Gshow retornou status HTTP ${response.status}. Poss\xEDvel restri\xE7\xE3o de container IP. Ativando fallback seguro.`);
        useFallback = true;
      } else {
        html = await response.text();
        addLog("success", "HTML de listagem principal do Gshow recebido com sucesso. Iniciando an\xE1lise DOM n\xE3o-IA...");
        const $ = cheerio.load(html);
        const novelaLinks = [];
        $("a").each((i, el) => {
          const href = $(el).attr("href") || "";
          const titleText = $(el).text().trim();
          if (href.includes("/novelas/") && href.split("/").filter(Boolean).length === 2 && !href.endsWith("/novelas/")) {
            const img = $(el).find("img").attr("src") || "";
            if (titleText && novelaLinks.every((l) => l.href !== href)) {
              novelaLinks.push({
                title: titleText,
                href: href.startsWith("http") ? href : `https:${href}`,
                image: img || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=1200"
              });
            }
          }
        });
        if (novelaLinks.length === 0) {
          addLog("warn", "Nenhum container de novela ativo localizado no DOM atual (poss\xEDvel mudan\xE7a din\xE2mica no layout Gshow/React). Ativando cat\xE1logo estruturado de fallback.");
          useFallback = true;
        } else {
          addLog("info", `Localizadas ${novelaLinks.length} novelas em andamento ou recentes no Gshow. Executando extra\xE7\xE3o...`);
          for (const link of novelaLinks.slice(0, 3)) {
            const id = link.href.split("/").filter(Boolean).pop() || "novela";
            const title = link.title;
            const url = link.href;
            const banner = link.image;
            addLog("info", `Iniciando etapa 2: buscando elenco para a novela [${title}] em ${url}e /personagens/...`);
            let characters = [];
            try {
              const charRes = await fetch(`${url}personagens/`, {
                headers: { "User-Agent": "Mozilla/5.0" }
              });
              if (charRes.ok) {
                const charHtml = await charRes.text();
                const c$ = cheerio.load(charHtml);
                c$(".card, .personagem, .elenco, .feed-post").each((j, el) => {
                  const name = c$(el).find("h2, h3, .title, .name").first().text().trim();
                  const actor = c$(el).find(".actor, .nome-ator, .subtitle").first().text().trim() || "Elenco Gshow";
                  const photo = c$(el).find("img").attr("src") || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600";
                  const description = c$(el).find(".description, .text, p").first().text().trim() || "Personagem da novela da TV Globo.";
                  if (name && characters.every((char) => char.name !== name)) {
                    const charId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    characters.push({
                      id: `${id}_${charId}`,
                      novelaId: id,
                      name,
                      actor,
                      photo: photo.startsWith("//") ? `https:${photo}` : photo,
                      description,
                      storyPointOfView: `Personagem relevante investigando os rumos de ${title}.`,
                      lastHappenings: "Previs\xF5es apontam participa\xE7\xE3o ativa nos eventos emocionantes desta semana."
                    });
                  }
                });
              }
            } catch (e) {
              addLog("warn", `Falha ao requisitar elencos de ${title}: ${e instanceof Error ? e.message : String(e)}`);
            }
            const novelaDoc = {
              id,
              title,
              banner,
              status: "Em exibi\xE7\xE3o",
              url,
              summary: `Novela de grande audi\xEAncia da TV Globo. Saiba tudo sobre a trama e os personagens acompanhando as previs\xF5es em tempo real.`,
              lastScraped: (/* @__PURE__ */ new Date()).toISOString()
            };
            const novelaRef = db2.collection("novelas").doc(id);
            await novelaRef.set(novelaDoc);
            liveScrapeCount++;
            if (characters.length > 0) {
              for (const char of characters) {
                await novelaRef.collection("characters").doc(char.id).set(char);
                liveCharCount++;
              }
              addLog("success", `Extra\xEDdos com sucesso ${characters.length} personagens reais para [${title}] via DOM cheerio parser.`);
            } else {
              const defaultSeed = LIVE_NOVELAS_SEED.find((s) => s.novela.id === id || s.novela.title.toLowerCase().includes(title.toLowerCase()));
              if (defaultSeed) {
                addLog("info", `Sem personagens estruturados identificados para [${title}]. Injetando correspondente cat\xE1logo verificado para enriquecer visual.`);
                for (const sChar of defaultSeed.characters) {
                  await novelaRef.collection("characters").doc(sChar.id).set(sChar);
                  liveCharCount++;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      addLog("error", `Falha geral na rede ou bloqueio de requisi\xE7\xE3o externa: ${error instanceof Error ? error.message : String(error)}. Ativando fallback de alta fidelidade.`);
      useFallback = true;
    }
  }
  if (useFallback) {
    addLog("info", "Mesclando cat\xE1logo local das novelas atuais (Vale Tudo, Garota do Momento, Volta por Cima) com o Firestore banco de dados ativo...");
    for (const item of LIVE_NOVELAS_SEED) {
      const novelaRef = db2.collection("novelas").doc(item.novela.id);
      await novelaRef.set(item.novela);
      liveScrapeCount++;
      for (const char of item.characters) {
        await novelaRef.collection("characters").doc(char.id).set(char);
        liveCharCount++;
      }
      addLog("success", `Injetada novela e elenco correspondentes de: [${item.novela.title}] (${item.characters.length} personagens reais configurados)`);
    }
  }
  try {
    const novelasSnapshot = await db2.collection("novelas").get();
    for (const doc of novelasSnapshot.docs) {
      const novId = doc.id;
      const novTitle = doc.data().title;
      const predSnapshot = await db2.collection("predictions").where("novelaId", "==", novId).limit(1).get();
      if (predSnapshot.empty) {
        addLog("info", `Criando cartelas de bol\xE3o iniciais para a novela [${novTitle}]...`);
        const defaultPreds = getCuratedPredictionsFallback(novId, novTitle);
        for (const pred of defaultPreds) {
          await db2.collection("predictions").doc(pred.id).set(pred);
        }
        addLog("success", `Cartelas de bol\xE3o iniciais ativas para [${novTitle}].`);
      }
    }
  } catch (predErr) {
    addLog("warn", `Falha ao preencher as cartelas de bol\xE3o automaticamente: ${predErr instanceof Error ? predErr.message : String(predErr)}`);
  }
  addLog("success", `Crawler di\xE1rio finalizado! ${liveScrapeCount} novelas e ${liveCharCount} personagens persistidos em tempo real no Firestore.`);
  return {
    success: true,
    novelasCount: liveScrapeCount,
    charactersCount: liveCharCount,
    logs
  };
}

// server.ts
init_gemini();

// src/services/localDb.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
init_gemini();
var DB_FILE_PATH = import_path.default.join(process.cwd(), "db.json");
var LocalDatabase = class {
  constructor() {
    this.data = {
      novelas: [],
      predictions: [],
      episodicPredictions: [],
      users: [],
      votes: {}
    };
    this.load();
    if (this.data.novelas.length === 0) {
      this.bootstrapDefaults();
    }
  }
  load() {
    try {
      if (import_fs.default.existsSync(DB_FILE_PATH)) {
        const fileContent = import_fs.default.readFileSync(DB_FILE_PATH, "utf-8");
        this.data = JSON.parse(fileContent);
        if (!this.data.novelas) this.data.novelas = [];
        if (!this.data.predictions) this.data.predictions = [];
        if (!this.data.episodicPredictions) this.data.episodicPredictions = [];
        if (!this.data.users) this.data.users = [];
        if (!this.data.votes) this.data.votes = {};
        console.log(`[LocalDatabase] Successfully loaded persistent local database from: ${DB_FILE_PATH}`);
      } else {
        console.log("[LocalDatabase] db.json file of persistent storage not found. A fresh one will be written.");
      }
    } catch (err) {
      console.error("[LocalDatabase] Error reading db.json. Fallback to empty memory state.", err);
    }
  }
  save() {
    try {
      import_fs.default.writeFileSync(DB_FILE_PATH, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("[LocalDatabase] Error writing to db.json", err);
    }
  }
  bootstrapDefaults() {
    console.log("[LocalDatabase] Bootstrapping curated Brazilian telenovelas seeds...");
    for (const seed of LIVE_NOVELAS_SEED) {
      this.data.novelas.push({
        ...seed.novela,
        characters: seed.characters,
        facts: this.getDefaultFactsForNovela(seed.novela.id)
      });
      const curated = getCuratedPredictionsFallback(seed.novela.id, seed.novela.title);
      for (const card of curated) {
        this.data.predictions.push({
          id: card.id,
          novelaId: card.novelaId,
          title: card.title,
          description: card.description,
          options: card.options,
          votes: card.votes || { "Sim": 0, "N\xE3o": 0 },
          mainTrend: card.mainTrend || "Indefinido",
          createdAt: card.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
          aiAnalysis: card.aiAnalysis,
          aiConfidence: card.aiConfidence
        });
      }
    }
    this.save();
    console.log("[LocalDatabase] Seeding finished successfully.");
  }
  getDefaultFactsForNovela(novelaId) {
    const defaultNovelaFacts = {
      "vale-tudo-remake": [
        "Maria de F\xE1tima foi flagrada em flagrante em Angra dos Reis conspirando com C\xE9sar Ribeiro.",
        "Afonso Roitman suspeita profundamente das inten\xE7\xF5es de sua irm\xE3 Solange sobre a heran\xE7a de fam\xEDlia.",
        "Raquel recusou apoiar a expans\xE3o comercial de C\xE9sar por discordar veementemente de sua idoneidade."
      ],
      "garota-do-momento": [
        "Beatriz humilhou a rival no desfile da Perfumaria Carioca ao expor as mentiras sobre a fita de grava\xE7\xE3o.",
        "Clarice sentiu uma forte tontura ao recordar o timbre de voz de sua verdadeira filha Beatriz.",
        "Juliano amea\xE7ou tirar todo o investimento da ag\xEAncia de publicidade caso os deslizes de sua filha continuem."
      ],
      "volta-por-cima": [
        "Madalena e J\xE3o conseguiram a c\xF3pia digitalizada de libera\xE7\xE3o do montante do bilhete de loteria deixado por Lindomar.",
        "Tio Osmar comprou um apartamento cinematogr\xE1fico no Leblon sob um codinome fantasma.",
        "Chico tentou atrapalhar o reencontro rom\xE2ntico de Madalena e J\xE3o no terminal rodovi\xE1rio da Via\xE7\xE3o Formosa."
      ]
    };
    return defaultNovelaFacts[novelaId] || [
      "Novos mist\xE9rios cercam a recep\xE7\xE3o fria entre os personagens principais.",
      "Uma alian\xE7a duvidosa sacudiu os bastidores da \xFAltima semana.",
      "Conversas vazadas de bastidores geraram especula\xE7\xF5es sobre a pr\xF3xima grande revela\xE7\xE3o."
    ];
  }
  // API Methods
  forceSave() {
    this.save();
  }
  getNovelas() {
    return this.data.novelas;
  }
  getPredictions() {
    return this.data.predictions;
  }
  getFacts(novelaId) {
    const novela = this.data.novelas.find((n) => n.id === novelaId);
    return novela ? novela.facts : this.getDefaultFactsForNovela(novelaId);
  }
  addFact(novelaId, text) {
    const novela = this.data.novelas.find((n) => n.id === novelaId);
    if (novela) {
      if (!novela.facts) novela.facts = [];
      novela.facts.push(text);
      this.save();
      return true;
    }
    return false;
  }
  saveNovelasFromCrawler(novelasWithChars) {
    for (const item of novelasWithChars) {
      const existing = this.data.novelas.find((n) => n.id === item.novela.id);
      if (existing) {
        existing.title = item.novela.title;
        existing.banner = item.novela.banner;
        existing.summary = item.novela.summary;
        existing.lastScraped = item.novela.lastScraped;
        existing.characters = item.characters;
      } else {
        this.data.novelas.push({
          ...item.novela,
          characters: item.characters,
          facts: this.getDefaultFactsForNovela(item.novela.id)
        });
      }
    }
    this.save();
  }
  savePredictionsFromGemini(novelaId, predictions) {
    this.data.predictions = this.data.predictions.filter((p) => p.novelaId !== novelaId);
    this.data.predictions.push(...predictions);
    this.save();
  }
  votePrediction(predictionId, option, userId, displayName, photo, email) {
    const prediction = this.data.predictions.find((p) => p.id === predictionId);
    if (!prediction) return null;
    const voteKey = `${userId}_${predictionId}`;
    const previousVote = this.data.votes[voteKey];
    if (!prediction.votes) prediction.votes = {};
    if (previousVote) {
      const oldOpt = previousVote.option;
      if (prediction.votes[oldOpt] && prediction.votes[oldOpt] > 0) {
        prediction.votes[oldOpt]--;
      }
    }
    prediction.votes[option] = (prediction.votes[option] || 0) + 1;
    this.data.votes[voteKey] = { option, selectedAt: (/* @__PURE__ */ new Date()).toISOString() };
    let leading = option;
    let maxCount = prediction.votes[option];
    for (const opt in prediction.votes) {
      if (prediction.votes[opt] > maxCount) {
        maxCount = prediction.votes[opt];
        leading = opt;
      }
    }
    prediction.mainTrend = leading;
    this.awardPointsToUser(userId, 10, displayName, photo, email);
    this.save();
    return prediction;
  }
  getEpisodicPredictions(novelaId, episode) {
    return this.data.episodicPredictions.filter((p) => p.novelaId === novelaId && p.episode === episode);
  }
  saveEpisodicPredictions(preds) {
    for (const item of preds) {
      const idx = this.data.episodicPredictions.findIndex((p) => p.id === item.id);
      if (idx !== -1) {
        this.data.episodicPredictions[idx] = item;
      } else {
        this.data.episodicPredictions.push(item);
      }
    }
    this.save();
  }
  voteEpisodicPrediction(predictionId, option, userId, displayName) {
    const prediction = this.data.episodicPredictions.find((p) => p.id === predictionId);
    if (!prediction) return null;
    const voteKey = `${userId}_${predictionId}`;
    const previousVote = this.data.votes[voteKey];
    if (!prediction.votes) prediction.votes = {};
    if (previousVote) {
      const oldOpt = previousVote.option;
      if (prediction.votes[oldOpt] && prediction.votes[oldOpt] > 0) {
        prediction.votes[oldOpt]--;
      }
    }
    prediction.votes[option] = (prediction.votes[option] || 0) + 1;
    this.data.votes[voteKey] = { option, selectedAt: (/* @__PURE__ */ new Date()).toISOString() };
    let leading = option;
    let maxCount = prediction.votes[option];
    for (const opt in prediction.votes) {
      if (prediction.votes[opt] > maxCount) {
        maxCount = prediction.votes[opt];
        leading = opt;
      }
    }
    prediction.mainTrend = leading;
    this.awardPointsToUser(userId, 15, displayName);
    this.save();
    return prediction;
  }
  broadcastEpisode(novelaId, episode) {
    const beforeCount = this.data.episodicPredictions.length;
    const expiredPreds = this.data.episodicPredictions.filter((p) => p.novelaId === novelaId && p.episode === episode);
    this.data.episodicPredictions = this.data.episodicPredictions.filter((p) => !(p.novelaId === novelaId && p.episode === episode));
    for (const pred of expiredPreds) {
      for (const k of Object.keys(this.data.votes)) {
        if (k.endsWith(`_${pred.id}`)) {
          delete this.data.votes[k];
        }
      }
    }
    this.save();
    return beforeCount - this.data.episodicPredictions.length;
  }
  awardPointsToUser(userId, points, displayName, photo, email) {
    let user = this.data.users.find((u) => u.uid === userId);
    if (user) {
      user.points += points;
      if (displayName) user.displayName = displayName;
      if (photo) user.photoURL = photo;
    } else {
      this.data.users.push({
        uid: userId,
        displayName: displayName || "F\xE3 de Novela",
        email: email || "",
        photoURL: photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
        points,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
};
var localDb = new LocalDatabase();

// src/services/tmdb.ts
function cleanTitleForQuery(title) {
  let clean = title.replace(/\([^)]*\)/g, "").trim();
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}
async function enrichWithTMDB(novelas) {
  const logs = [];
  const statusLog = (msg) => {
    console.log(`[TMDB Service] ${msg}`);
    logs.push(msg);
  };
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || apiKey === "MY_TMDB_API_KEY" || apiKey.trim() === "") {
    statusLog("Avisos: TMDB_API_KEY n\xE3o configurada no painel de segredos (.env / secrets). Enriquecimento pulado.");
    return { enrichedCount: 0, logs };
  }
  statusLog("Iniciando enriquecimento de cat\xE1logo via API do TMDB...");
  let enrichedCount = 0;
  for (const item of novelas) {
    const novelaId = item.novela?.id || item.id;
    const currentTitle = item.novela?.title || item.title;
    const charactersList = item.characters || [];
    if (!currentTitle) continue;
    const query = cleanTitleForQuery(currentTitle);
    statusLog(`Procurando novela: "${query}" (T\xEDtulo original: "${currentTitle}")`);
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=pt-BR`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        statusLog(`Erro na busca TMDB para "${query}": Status ${searchRes.status}`);
        continue;
      }
      const searchData = await searchRes.json();
      const results = searchData.results || [];
      if (results.length === 0) {
        statusLog(`Nenhum resultado encontrado no TMDB para a novela "${query}".`);
        continue;
      }
      const bestMatch = results[0];
      statusLog(`Correspond\xEAncia encontrada: "${bestMatch.name}" (TMDB ID: ${bestMatch.id})`);
      if (item.novela) {
        if (bestMatch.backdrop_path) {
          item.novela.banner = `https://image.tmdb.org/t/p/w1280${bestMatch.backdrop_path}`;
        } else if (bestMatch.poster_path) {
          item.novela.banner = `https://image.tmdb.org/t/p/w780${bestMatch.poster_path}`;
        }
      } else {
        if (bestMatch.backdrop_path) {
          item.banner = `https://image.tmdb.org/t/p/w1280${bestMatch.backdrop_path}`;
        } else if (bestMatch.poster_path) {
          item.banner = `https://image.tmdb.org/t/p/w780${bestMatch.poster_path}`;
        }
      }
      const creditsUrl = `https://api.themoviedb.org/3/tv/${bestMatch.id}/credits?api_key=${apiKey}&language=pt-BR`;
      const creditsRes = await fetch(creditsUrl);
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        const cast = creditsData.cast || [];
        statusLog(`Carregados ${cast.length} elenco(s) do TMDB para "${bestMatch.name}".`);
        let matchedActors = 0;
        for (const char of charactersList) {
          let match = cast.find(
            (c) => c.name.toLowerCase() === char.actor.toLowerCase() || char.actor.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(char.actor.toLowerCase())
          );
          if (!match) {
            match = cast.find(
              (c) => c.character.toLowerCase().includes(char.name.toLowerCase()) || char.name.toLowerCase().includes(c.character.toLowerCase())
            );
          }
          if (match && match.profile_path) {
            char.photo = `https://image.tmdb.org/t/p/h632${match.profile_path}`;
            matchedActors++;
          }
        }
        statusLog(`Enriquecidos ${matchedActors}/${charactersList.length} atores com fotos reais TMDB!`);
      }
      enrichedCount++;
    } catch (err) {
      statusLog(`Exce\xE7\xE3o durante busca TMDB para "${currentTitle}": ${err?.message || String(err)}`);
    }
  }
  statusLog(`Finalizado. Enriquecidas ${enrichedCount} novelas.`);
  return { enrichedCount, logs };
}
async function enrichDatabaseWithTMDB(db2, useLocalFallback2) {
  const logs = [];
  const statusLog = (msg) => {
    console.log(`[TMDB Database Enricher] ${msg}`);
    logs.push(msg);
  };
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || apiKey === "MY_TMDB_API_KEY" || apiKey.trim() === "") {
    statusLog("TMDB_API_KEY n\xE3o configurada nos Segredos do app. Enriquecimento ignorado.");
    return { success: false, enrichedCount: 0, logs };
  }
  try {
    if (useLocalFallback2) {
      statusLog("Executando enriquecimento no Banco de Dados Local (localDb/db.json)...");
      const novelas = localDb.getNovelas();
      const { enrichedCount, logs: tmdbLogs } = await enrichWithTMDB(novelas);
      logs.push(...tmdbLogs);
      localDb.forceSave();
      statusLog("Banco de Dados Local persistido com sucesso!");
      return { success: true, enrichedCount, logs };
    } else {
      statusLog("Executando enriquecimento no Banco de Dados de Produ\xE7\xE3o (Firestore)...");
      const novelasSnapshot = await db2.collection("novelas").get();
      const novelasToEnrich = [];
      for (const doc of novelasSnapshot.docs) {
        const data = doc.data();
        const charsSnapshot = await doc.ref.collection("characters").get();
        const characters = charsSnapshot.docs.map((c) => c.data());
        novelasToEnrich.push({
          id: doc.id,
          title: data.title,
          banner: data.banner,
          characters
        });
      }
      const { enrichedCount, logs: tmdbLogs } = await enrichWithTMDB(novelasToEnrich);
      logs.push(...tmdbLogs);
      for (const item of novelasToEnrich) {
        statusLog(`Atualizando novela [${item.title}] no Firestore...`);
        await db2.collection("novelas").doc(item.id).update({
          banner: item.banner,
          lastScraped: (/* @__PURE__ */ new Date()).toISOString()
        });
        for (const char of item.characters) {
          await db2.collection("novelas").doc(item.id).collection("characters").doc(char.id).update({
            photo: char.photo
          });
        }
      }
      statusLog(`Banco de Dados Firestore atualizado com sucesso para ${enrichedCount} novelas!`);
      return { success: true, enrichedCount, logs };
    }
  } catch (error) {
    statusLog(`Erro grave durante enriquecimento database TMDB: ${error?.message || String(error)}`);
    return { success: false, enrichedCount: 0, logs };
  }
}

// server.ts
var DIAGNOSTICS = {
  initialized: false,
  bootstrapStatus: "pending",
  bootstrapError: null,
  crawlerOnStartupResult: null,
  firestoreDatabaseId: firebase_applet_config_default.firestoreDatabaseId,
  projectId: firebase_applet_config_default.projectId,
  appsRegistered: 0
};
var firebaseApp;
try {
  if (import_firebase_admin.default.apps.length === 0) {
    console.log(`[Firebase Admin] Handshaking and initializing admin SDK using explicit projectId: ${firebase_applet_config_default.projectId}`);
    firebaseApp = import_firebase_admin.default.initializeApp({
      projectId: firebase_applet_config_default.projectId
    });
  } else {
    firebaseApp = import_firebase_admin.default.apps[0];
  }
  DIAGNOSTICS.appsRegistered = import_firebase_admin.default.apps.length;
} catch (initErr) {
  console.error("Critical error during firebase-admin initializeApp:", initErr);
  DIAGNOSTICS.bootstrapStatus = "initialization_failed";
  DIAGNOSTICS.bootstrapError = String(initErr);
}
var db = (0, import_firestore.getFirestore)(firebaseApp, firebase_applet_config_default.firestoreDatabaseId);
var useLocalFallback = false;
var mockDb = {
  collection: (collectionName) => {
    return {
      doc: (docId) => {
        return {
          id: docId,
          ref: {
            collection: (subCollectionName) => {
              return {
                doc: (subDocId) => {
                  return {
                    set: async (data) => {
                      if (collectionName === "novelas" && subCollectionName === "characters") {
                        let novela = localDb.getNovelas().find((n) => n.id === docId);
                        if (!novela) {
                          novela = { id: docId, title: docId, banner: "", status: "", url: "", summary: "", lastScraped: "", characters: [], facts: [] };
                          localDb.getNovelas().push(novela);
                        }
                        const idx = novela.characters.findIndex((c) => c.id === subDocId);
                        if (idx !== -1) {
                          novela.characters[idx] = data;
                        } else {
                          novela.characters.push(data);
                        }
                      } else if (collectionName === "novelas" && subCollectionName === "facts") {
                        localDb.addFact(docId, data.text);
                      }
                    }
                  };
                }
              };
            }
          },
          set: async (data) => {
            if (collectionName === "novelas") {
              let novela = localDb.getNovelas().find((n) => n.id === docId);
              if (novela) {
                Object.assign(novela, data);
              } else {
                localDb.getNovelas().push({ ...data, characters: [], facts: [] });
              }
            } else if (collectionName === "predictions") {
              const idx = localDb.getPredictions().findIndex((p) => p.id === docId);
              if (idx !== -1) {
                Object.assign(localDb.getPredictions()[idx], data);
              } else {
                localDb.getPredictions().push(data);
              }
            } else if (collectionName === "episodic_predictions") {
              localDb.saveEpisodicPredictions([data]);
            }
          }
        };
      },
      get: async () => {
        return {
          docs: (collectionName === "novelas" ? localDb.getNovelas() : localDb.getPredictions()).map((item) => ({
            id: item.id,
            data: () => item
          })),
          empty: (collectionName === "novelas" ? localDb.getNovelas() : localDb.getPredictions()).length === 0
        };
      },
      where: (field1, op1, val1) => {
        return {
          where: (field2, op2, val2) => {
            return {
              get: async () => {
                if (collectionName === "episodic_predictions") {
                  const filtered = localDb.getEpisodicPredictions(val1, val2);
                  return {
                    docs: filtered.map((item) => ({
                      id: item.id,
                      data: () => item
                    })),
                    empty: filtered.length === 0
                  };
                }
                return { docs: [], empty: true };
              }
            };
          },
          limit: (n) => {
            return {
              get: async () => {
                const filtered = localDb.getPredictions().filter((p) => p[field1] === val1).slice(0, n);
                return {
                  docs: filtered.map((item) => ({
                    id: item.id,
                    data: () => item
                  })),
                  empty: filtered.length === 0
                };
              }
            };
          }
        };
      }
    };
  }
};
async function checkAndBootstrapSeeds() {
  console.log(`[Bootstrap] Starting DB seeds check for database [${firebase_applet_config_default.firestoreDatabaseId}]...`);
  DIAGNOSTICS.bootstrapStatus = "running";
  try {
    const novelasSnapshot = await db.collection("novelas").limit(1).get();
    if (novelasSnapshot.empty) {
      console.log("[Bootstrap] Database is completely empty. Launching initial Gshow safe seeding catalog with instant local verified seed...");
      const result = await runGshowCrawler(db, { forceFallback: true });
      DIAGNOSTICS.crawlerOnStartupResult = result;
      DIAGNOSTICS.bootstrapStatus = "seeded_successfully";
    } else {
      console.log("[Bootstrap] Database already contains active novelas. Checking predictions sweepstakes cards...");
      const predictionsSnapshot = await db.collection("predictions").limit(1).get();
      if (predictionsSnapshot.empty) {
        console.log("[Bootstrap] Predictions collection is empty. Seeding default sweepstakes cards from fallback...");
        const { getCuratedPredictionsFallback: getCuratedPredictionsFallback2 } = await Promise.resolve().then(() => (init_gemini(), gemini_exports));
        const novelas = await db.collection("novelas").get();
        for (const doc of novelas.docs) {
          const id = doc.id;
          const title = doc.data().title;
          const fallbackPreds = getCuratedPredictionsFallback2(id, title);
          for (const pred of fallbackPreds) {
            await db.collection("predictions").doc(pred.id).set(pred);
          }
        }
        console.log("[Bootstrap] Predictions pre-seeded successfully.");
        DIAGNOSTICS.bootstrapStatus = "populated_with_predictions_seeded";
      } else {
        console.log("[Bootstrap] Predictions already populated. Ready.");
        DIAGNOSTICS.bootstrapStatus = "already_populated";
      }
    }
    DIAGNOSTICS.initialized = true;
    if (process.env.TMDB_API_KEY) {
      console.log("[Bootstrap] Enriching bootstrapped novelas with TMDB real photos...");
      await enrichDatabaseWithTMDB(db, useLocalFallback);
    }
  } catch (err) {
    console.error("[Bootstrap] Seeding check failed on Firestore. Switching dynamically to Local DB Fallback Mode.", err);
    useLocalFallback = true;
    DIAGNOSTICS.bootstrapStatus = "failed_switching_to_local_fallback";
    DIAGNOSTICS.bootstrapError = String(err);
    try {
      if (localDb.getNovelas().length === 0) {
        console.log("[Bootstrap-Local] Local DB has no novelas yet. Bootstrapping local catalog seamlessly...");
        await runGshowCrawler(mockDb, { forceFallback: true });
      }
      if (process.env.TMDB_API_KEY) {
        console.log("[Bootstrap-Local] Enriching local novelas with TMDB real photos...");
        await enrichDatabaseWithTMDB(mockDb, true);
      }
    } catch (localErr) {
      console.error("[Bootstrap-Local] Failed to seed local storage backup: ", localErr);
    }
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      diagnostics: DIAGNOSTICS
    });
  });
  app.get("/api/novelas", async (req, res) => {
    try {
      if (useLocalFallback) {
        return res.json(localDb.getNovelas());
      }
      const novelasSnapshot = await db.collection("novelas").get();
      const novelas = [];
      for (const doc of novelasSnapshot.docs) {
        const data = doc.data();
        const charactersSnapshot = await doc.ref.collection("characters").get();
        const characters = charactersSnapshot.docs.map((c) => c.data());
        novelas.push({
          ...data,
          characters
        });
      }
      res.json(novelas);
    } catch (error) {
      console.warn("[Firestore] Error fetching novelas, falling back to local database...", error);
      useLocalFallback = true;
      res.json(localDb.getNovelas());
    }
  });
  app.get("/api/predictions", async (req, res) => {
    try {
      if (useLocalFallback) {
        return res.json(localDb.getPredictions());
      }
      const predictionsSnapshot = await db.collection("predictions").get();
      const predictions = predictionsSnapshot.docs.map((doc) => doc.data());
      res.json(predictions);
    } catch (error) {
      console.warn("[Firestore] Error fetching predictions, falling back to local database...", error);
      useLocalFallback = true;
      res.json(localDb.getPredictions());
    }
  });
  app.post("/api/predictions/:predictionId/vote", async (req, res) => {
    const { predictionId } = req.params;
    const { option, userId, userDisplayName, userPhoto, userEmail } = req.body;
    if (!option || !userId) {
      res.status(400).json({ error: "Par\xE2metros 'option' e 'userId' s\xE3o obrigat\xF3rios." });
      return;
    }
    if (useLocalFallback) {
      console.log("[RouteFallback] Processing vote on prediction via localDB...");
      const updated = localDb.votePrediction(predictionId, option, userId, userDisplayName, userPhoto, userEmail);
      if (!updated) {
        res.status(404).json({ error: "Previs\xE3o / Dilema n\xE3o localizado." });
        return;
      }
      return res.json({
        success: true,
        pointsAwarded: 10,
        prediction: updated
      });
    }
    try {
      const predictionRef = db.collection("predictions").doc(predictionId);
      const predictionDoc = await predictionRef.get();
      if (!predictionDoc.exists) {
        res.status(404).json({ error: "Previs\xE3o / Dilema n\xE3o localizado." });
        return;
      }
      const prediction = predictionDoc.data();
      const currentVotes = prediction?.votes || {};
      const voteId = `${userId}_${predictionId}`;
      const userVoteRef = predictionRef.collection("votes").doc(voteId);
      const userVoteDoc = await userVoteRef.get();
      let oldOption = null;
      if (userVoteDoc.exists) {
        oldOption = userVoteDoc.data()?.selectedOption;
      }
      await db.runTransaction(async (transaction) => {
        transaction.set(userVoteRef, {
          id: voteId,
          userId,
          predictionId,
          selectedOption: option,
          createdAt: import_firebase_admin.default.firestore.FieldValue.serverTimestamp()
        });
        const updatedVotes = { ...currentVotes };
        if (oldOption) {
          if (updatedVotes[oldOption] > 0) {
            updatedVotes[oldOption] -= 1;
          }
        }
        updatedVotes[option] = (updatedVotes[option] || 0) + 1;
        let maxOption = option;
        let maxCount = updatedVotes[option];
        for (const opt in updatedVotes) {
          if (updatedVotes[opt] > maxCount) {
            maxCount = updatedVotes[opt];
            maxOption = opt;
          }
        }
        transaction.update(predictionRef, {
          votes: updatedVotes,
          mainTrend: maxOption
        });
      });
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await userRef.update({
          points: import_firebase_admin.default.firestore.FieldValue.increment(10)
        });
      } else {
        await userRef.set({
          uid: userId,
          displayName: userDisplayName || "F\xE3 de Novela",
          email: userEmail || req.body.userEmail || "",
          photoURL: userPhoto || req.body.userPhoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
          points: 10,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      const updatedPredDoc = await predictionRef.get();
      res.json({
        success: true,
        pointsAwarded: 10,
        prediction: updatedPredDoc.data()
      });
    } catch (error) {
      console.warn("[Firestore] Error voting on prediction, falling back to local database...", error);
      useLocalFallback = true;
      const updated = localDb.votePrediction(predictionId, option, userId, userDisplayName, userPhoto, userEmail);
      if (!updated) {
        res.status(500).json({ error: "Erro interno ao computar voto e pontos.", details: String(error) });
        return;
      }
      res.json({
        success: true,
        pointsAwarded: 10,
        prediction: updated
      });
    }
  });
  app.post("/api/crawl", async (req, res) => {
    try {
      const targetDb = useLocalFallback ? mockDb : db;
      const result = await runGshowCrawler(targetDb);
      if (process.env.TMDB_API_KEY) {
        console.log("[Crawler API] Triggering automatic post-crawl TMDB enrichment...");
        await enrichDatabaseWithTMDB(targetDb, useLocalFallback);
      }
      res.json(result);
    } catch (error) {
      console.warn("[Firestore] Error executing crawler, trying with local database fallback...", error);
      useLocalFallback = true;
      try {
        const result = await runGshowCrawler(mockDb);
        if (process.env.TMDB_API_KEY) {
          console.log("[Crawler API] Triggering automatic post-crawl TMDB enrichment (fallback)...");
          await enrichDatabaseWithTMDB(mockDb, true);
        }
        res.json(result);
      } catch (localErr) {
        res.status(500).json({ error: "Erro na execu\xE7\xE3o do crawler Gshow.", details: String(localErr) });
      }
    }
  });
  app.post("/api/tmdb/enrich", async (req, res) => {
    try {
      const targetDb = useLocalFallback ? mockDb : db;
      const result = await enrichDatabaseWithTMDB(targetDb, useLocalFallback);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Falha ao executar enriquecimento TMDB.",
        error: error?.message || String(error)
      });
    }
  });
  app.post("/api/generate-predictions", async (req, res) => {
    const { novelaId, novelaTitle } = req.body;
    if (!novelaId || !novelaTitle) {
      res.status(400).json({ error: "id e t\xEDtulo da novela s\xE3o obrigat\xF3rios." });
      return;
    }
    try {
      const targetDb = useLocalFallback ? mockDb : db;
      const predictions = await generatePredictionsForNovela(novelaId, novelaTitle, targetDb);
      res.json({
        success: true,
        predictions
      });
    } catch (error) {
      console.warn("[Firestore] Error generating predictions, trying with local database fallback...", error);
      useLocalFallback = true;
      try {
        const predictions = await generatePredictionsForNovela(novelaId, novelaTitle, mockDb);
        res.json({
          success: true,
          predictions
        });
      } catch (localErr) {
        res.status(500).json({ error: "Erro ao gerar previs\xF5es via IA.", details: String(localErr) });
      }
    }
  });
  const defaultNovelaFacts = {
    "vale-tudo-remake": [
      "Maria de F\xE1tima foi flagrada em flagrante em Angra dos Reis conspirando com C\xE9sar Ribeiro.",
      "Afonso Roitman suspeita profundamente das inten\xE7\xF5es de sua irm\xE3 Solange sobre a heran\xE7a de fam\xEDlia.",
      "Raquel recusou apoiar a expans\xE3o comercial de C\xE9sar por discordar veementemente de sua idoneidade."
    ],
    "garota-do-momento": [
      "Beatriz humilhou a rival no desfile da Perfumaria Carioca ao expor as mentiras sobre a fita de grava\xE7\xE3o.",
      "Clarice sentiu uma forte tontura ao recordar o timbre de voz de sua verdadeira filha Beatriz.",
      "Juliano amea\xE7ou tirar todo o investimento da ag\xEAncia de publicidade caso os deslizes de sua filha continuem."
    ],
    "volta-por-cima": [
      "Madalena e J\xE3o conseguiram a c\xF3pia digitalizada de libera\xE7\xE3o do montante do bilhete de loteria deixado por Lindomar.",
      "Tio Osmar comprou um apartamento cinematogr\xE1fico no Leblon sob um codinome fantasma.",
      "Chico tentou atrapalhar o reencontro rom\xE2ntico de Madalena e J\xE3o no terminal rodovi\xE1rio da Via\xE7\xE3o Formosa."
    ]
  };
  app.get("/api/novelas/:novelaId/facts", async (req, res) => {
    const { novelaId } = req.params;
    if (useLocalFallback) {
      console.log("[RouteFallback] Serving facts from local db...");
      return res.json(localDb.getFacts(novelaId));
    }
    try {
      const factsSnapshot = await db.collection("novelas").doc(novelaId).collection("facts").orderBy("createdAt", "asc").get();
      let facts = factsSnapshot.docs.map((doc) => doc.data().text);
      if (facts.length === 0) {
        const defaults = defaultNovelaFacts[novelaId] || [
          "Novos mist\xE9rios cercam a recep\xE7\xE3o fria entre os personagens principais.",
          "Uma alian\xE7a duvidosa sacudiu os bastidores da \xFAltima semana.",
          "Conversas vazadas de bastidores geraram especula\xE7\xF5es sobre a pr\xF3xima grande revela\xE7\xE3o."
        ];
        for (const [idx, text] of defaults.entries()) {
          const docId = `fact_${novelaId}_seed_${idx}`;
          await db.collection("novelas").doc(novelaId).collection("facts").doc(docId).set({
            text,
            createdAt: new Date(Date.now() - (defaults.length - idx) * 6e4).toISOString()
          });
        }
        facts = defaults;
      }
      res.json(facts);
    } catch (error) {
      console.warn("[Firestore] Error fetching facts, trying local fallback...", error);
      useLocalFallback = true;
      res.json(localDb.getFacts(novelaId));
    }
  });
  app.post("/api/novelas/:novelaId/facts", async (req, res) => {
    const { novelaId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ error: "Texto do fato \xE9 obrigat\xF3rio e n\xE3o pode ser vazio." });
      return;
    }
    if (useLocalFallback) {
      console.log("[RouteFallback] Adding fact to localDb...");
      localDb.addFact(novelaId, text);
      return res.json({ success: true, text });
    }
    try {
      const factId = `fact_${novelaId}_${Date.now()}`;
      await db.collection("novelas").doc(novelaId).collection("facts").doc(factId).set({
        text,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, text });
    } catch (error) {
      console.warn("[Firestore] Error adding fact, trying local fallback...", error);
      useLocalFallback = true;
      localDb.addFact(novelaId, text);
      res.json({ success: true, text });
    }
  });
  app.get("/api/episodic-predictions/:novelaId/:episode", async (req, res) => {
    const { novelaId, episode } = req.params;
    if (useLocalFallback) {
      console.log("[RouteFallback] Fetching episodic predictions from local db...");
      return res.json(localDb.getEpisodicPredictions(novelaId, episode));
    }
    try {
      const snapshot = await db.collection("episodic_predictions").where("novelaId", "==", novelaId).where("episode", "==", episode).get();
      const predictions = snapshot.docs.map((doc) => doc.data());
      res.json(predictions);
    } catch (error) {
      console.warn("[Firestore] Error fetching episodic predictions, trying local fallback...", error);
      useLocalFallback = true;
      res.json(localDb.getEpisodicPredictions(novelaId, episode));
    }
  });
  app.post("/api/generate-episodic-predictions", async (req, res) => {
    const { novelaId, novelaTitle, episode, factsList, characters } = req.body;
    if (!novelaId || !novelaTitle || !episode) {
      res.status(400).json({ error: "Par\xE2metros 'novelaId', 'novelaTitle' e 'episode' s\xE3o obrigat\xF3rios." });
      return;
    }
    try {
      const targetDb = useLocalFallback ? mockDb : db;
      const predictions = await generateEpisodicPredictions(novelaId, novelaTitle, episode, factsList || [], characters || [], targetDb);
      res.json({ success: true, predictions });
    } catch (error) {
      console.warn("[Firestore] Error generating episodic predictions, trying local fallback...", error);
      useLocalFallback = true;
      try {
        const predictions = await generateEpisodicPredictions(novelaId, novelaTitle, episode, factsList || [], characters || [], mockDb);
        res.json({ success: true, predictions });
      } catch (localErr) {
        res.status(500).json({ error: "Erro ao gerar ou ler previs\xF5es do epis\xF3dio.", details: String(localErr) });
      }
    }
  });
  app.post("/api/episodic-predictions/:predictionId/vote", async (req, res) => {
    const { predictionId } = req.params;
    const { option, userId, userDisplayName } = req.body;
    if (!option || !userId) {
      res.status(400).json({ error: "Par\xE2metros 'option' e 'userId' s\xE3o obrigat\xF3rios." });
      return;
    }
    if (useLocalFallback) {
      console.log("[RouteFallback] Voting on episodic prediction via local db...");
      const updated = localDb.voteEpisodicPrediction(predictionId, option, userId, userDisplayName);
      if (!updated) {
        res.status(404).json({ error: "Previs\xE3o epis\xF3dica n\xE3o localizada." });
        return;
      }
      return res.json({
        success: true,
        pointsAwarded: 15,
        prediction: updated
      });
    }
    try {
      const predictionRef = db.collection("episodic_predictions").doc(predictionId);
      const predictionDoc = await predictionRef.get();
      if (!predictionDoc.exists) {
        res.status(404).json({ error: "Previs\xE3o epis\xF3dica n\xE3o localizada." });
        return;
      }
      const prediction = predictionDoc.data();
      const currentVotes = prediction?.votes || {};
      const voteId = `${userId}_${predictionId}`;
      const userVoteRef = predictionRef.collection("votes").doc(voteId);
      const userVoteDoc = await userVoteRef.get();
      let oldOption = null;
      if (userVoteDoc.exists) {
        oldOption = userVoteDoc.data()?.selectedOption;
      }
      await db.runTransaction(async (transaction) => {
        transaction.set(userVoteRef, {
          id: voteId,
          userId,
          predictionId,
          selectedOption: option,
          createdAt: import_firebase_admin.default.firestore.FieldValue.serverTimestamp()
        });
        const updatedVotes = { ...currentVotes };
        if (oldOption) {
          if (updatedVotes[oldOption] > 0) {
            updatedVotes[oldOption] -= 1;
          }
        }
        updatedVotes[option] = (updatedVotes[option] || 0) + 1;
        let maxOption = option;
        let maxCount = updatedVotes[option];
        for (const opt in updatedVotes) {
          if (updatedVotes[opt] > maxCount) {
            maxCount = updatedVotes[opt];
            maxOption = opt;
          }
        }
        transaction.update(predictionRef, {
          votes: updatedVotes,
          mainTrend: maxOption
        });
      });
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        await userRef.update({
          points: import_firebase_admin.default.firestore.FieldValue.increment(15)
        });
      } else {
        await userRef.set({
          uid: userId,
          displayName: userDisplayName || "F\xE3 de Novela",
          points: 15,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      const updatedPredDoc = await predictionRef.get();
      res.json({
        success: true,
        pointsAwarded: 15,
        prediction: updatedPredDoc.data()
      });
    } catch (error) {
      console.warn("[Firestore] Error voting on episodic prediction, trying local fallback...", error);
      useLocalFallback = true;
      const updated = localDb.voteEpisodicPrediction(predictionId, option, userId, userDisplayName);
      if (!updated) {
        res.status(500).json({ error: "Erro ao computar voto epis\xF3dico.", details: String(error) });
        return;
      }
      res.json({
        success: true,
        pointsAwarded: 15,
        prediction: updated
      });
    }
  });
  app.post("/api/broadcast-episode", async (req, res) => {
    const { novelaId, episode } = req.body;
    if (!novelaId || !episode) {
      res.status(400).json({ error: "Par\xE2metros 'novelaId' e 'episode' s\xE3o obrigat\xF3rios." });
      return;
    }
    if (useLocalFallback) {
      console.log("[RouteFallback] Broadcasting episode via local db...");
      const count = localDb.broadcastEpisode(novelaId, episode);
      return res.json({
        success: true,
        deletedCount: count,
        message: `O ${episode} foi exibido na TV! Todas as previs\xF5es vinculadas a ele foram apagadas conforme combinado.`
      });
    }
    try {
      console.log(`[Broadcast Episode] Sintonizando TV. Transmiss\xE3o do [${episode}] na novela [${novelaId}]. Apagando previs\xF5es vinculadas...`);
      const snapshot = await db.collection("episodic_predictions").where("novelaId", "==", novelaId).where("episode", "==", episode).get();
      if (snapshot.empty) {
        res.json({ success: true, deletedCount: 0, message: "Nenhuma previs\xE3o ativa localizada para este epis\xF3dio." });
        return;
      }
      let deletedCount = 0;
      const batch = db.batch();
      for (const doc of snapshot.docs) {
        const votesSnapshot = await doc.ref.collection("votes").get();
        for (const voteDoc of votesSnapshot.docs) {
          batch.delete(voteDoc.ref);
        }
        batch.delete(doc.ref);
        deletedCount++;
      }
      await batch.commit();
      res.json({
        success: true,
        deletedCount,
        message: `O ${episode} foi exibido na TV! Todas as previs\xF5es vinculadas a ele foram apagadas conforme combinado.`
      });
    } catch (error) {
      console.warn("[Firestore] Error broadcasting episode, trying local fallback...", error);
      useLocalFallback = true;
      const count = localDb.broadcastEpisode(novelaId, episode);
      res.json({
        success: true,
        deletedCount: count,
        message: `O ${episode} foi exibido na TV! Todas as previs\xF5es vinculadas a ele foram apagadas conforme combinado.`
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Full-Stack Server] running on http://localhost:${PORT}`);
    checkAndBootstrapSeeds();
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
