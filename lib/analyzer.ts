import Anthropic from "@anthropic-ai/sdk"

const SECTION_PATTERNS = [
  /^SENTENÇA/i, /^ACÓRDÃO/i, /^ACORDAM/i,
  /Vistos,\s+relatados\s+e\s+discutidos/i,
  /JULGO\s+(PARCIALMENTE\s+)?PROCEDENTE/i,
  /JULGO\s+IMPROCEDENTE/i,
  /Ante o exposto/i, /ISTO POSTO/i, /Pelo exposto/i,
  /Diante do exposto/i, /Ex positis/i, /Em face do exposto/i,
  /Posto isso/i, /Por tais fundamentos/i, /^DISPOSITIVO/i,
  /Nego\s+provimento/i, /Negar\s+provimento/i, /Negam\s+provimento/i,
  /Dou\s+provimento/i, /Dar\s+provimento/i, /Deram\s+provimento/i,
  /\bcondeno\b/i,
]

const MAX_CHARS = 90000

function extractRelevantSections(text: string): string {
  if (text.length <= MAX_CHARS) return text
  const lines = text.split("\n")
  const sections: string[] = []
  let i = 0
  while (i < lines.length) {
    if (SECTION_PATTERNS.some((p) => p.test(lines[i]))) {
      const start = Math.max(0, i - 5)
      const end = Math.min(lines.length, i + 120)
      sections.push(lines.slice(start, end).join("\n"))
      i = end
    } else { i++ }
  }
  if (sections.length === 0 || sections.join("").length < 3000) {
    return (text.slice(0, 40000) + "\n\n[...]\n\n" + text.slice(-40000)).slice(0, MAX_CHARS)
  }
  let combined = sections.join("\n\n---\n\n")
  if (combined.length > MAX_CHARS) combined = combined.slice(-MAX_CHARS)
  return combined
}

export interface Advogado {
  nome: string
  oab: string
}

export interface ExtractedData {
  reclamante: string | null
  reclamada: string | null
  advogados_reclamada: Advogado[]
  houve_sentenca: boolean | null
  houve_condenacao: boolean | null
  descricao_condenacao: string | null
  valor_condenacao: number | null
  houve_recurso: boolean | null
  recurso_julgado: boolean | null
  resultado_recurso: string | null
  valor_acordao: number | null
}

function parseBool(v: string | null): boolean | null {
  if (!v) return null
  return v.toLowerCase() === "sim"
}

function parseMoney(v: string | null): number | null {
  if (!v || v.toLowerCase().includes("não") || v.toLowerCase().includes("nao")) return null
  const n = v.replace(/[^\d,\.]/g, "").replace(",", ".")
  const num = parseFloat(n)
  return isNaN(num) ? null : num
}

export async function analyzePdfBuffer(pdfBuffer: Buffer): Promise<ExtractedData> {
  // Extract text using pdf-parse
  const pdfParse = (await import("pdf-parse")).default
  const data = await pdfParse(pdfBuffer)
  const fullText = data.text?.trim() || ""

  if (fullText.length < 100) {
    throw new Error("PDF sem texto legível — pode ser escaneado sem OCR")
  }

  const relevantText = extractRelevantSections(fullText)

  const systemPrompt = `Você é um assistente jurídico especializado em análise de processos cíveis brasileiros.
INSTRUÇÃO CRÍTICA: Sua resposta deve conter EXCLUSIVAMENTE um objeto JSON. Comece com { e termine com }.
O JSON deve ter exatamente estas chaves:
{
  "reclamante": "Nome completo do reclamante/autor",
  "reclamada": "Nome completo da reclamada/réu",
  "houve_sentenca": "Sim" ou "Não",
  "houve_condenacao": "Sim" ou "Não",
  "descricao_condenacao": "Natureza da condenação ou Não aplicável",
  "valor_condenacao": "Valor em reais (ex: R$ 12.500,00) ou Não aplicável",
  "houve_recurso": "Sim" ou "Não",
  "recurso_julgado": "Sim ou Não ou Não aplicável",
  "resultado_recurso": "Descrição do resultado ou Não aplicável",
  "valor_acordao": "Valor em reais ou Não aplicável"
}
Se não estiver claro, use Não identificado. Responda SOMENTE o JSON.`

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada")
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: `Analise este processo cível:\n\n${relevantText}` }],
  })

  const raw = response.content.map((b) => (b.type === "text" ? b.text : "")).join("")
  let parsed: Record<string, string> | null = null

  try { parsed = JSON.parse(raw.trim()) } catch {}
  if (!parsed) { try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) } catch {} }
  if (!parsed) { const m = raw.match(/\{[\s\S]*\}/); if (m) try { parsed = JSON.parse(m[0]) } catch {} }
  if (!parsed) throw new Error("Resposta da IA em formato inválido")

  // Normaliza array de advogados
  let advogados: { nome: string; oab: string }[] = []
  if (Array.isArray(parsed.advogados_reclamada)) {
    advogados = parsed.advogados_reclamada
      .filter((a: unknown) => a && typeof a === "object")
      .map((a: unknown) => {
        const adv = a as Record<string, string>
        return { nome: adv.nome || "", oab: adv.oab || "" }
      })
      .filter(a => a.nome)
  }

  return {
    reclamante: parsed.reclamante || null,
    reclamada: parsed.reclamada || null,
    advogados_reclamada: advogados,
    houve_sentenca: parseBool(parsed.houve_sentenca),
    houve_condenacao: parseBool(parsed.houve_condenacao),
    descricao_condenacao: parsed.descricao_condenacao || null,
    valor_condenacao: parseMoney(parsed.valor_condenacao),
    houve_recurso: parseBool(parsed.houve_recurso),
    recurso_julgado: parseBool(parsed.recurso_julgado),
    resultado_recurso: parsed.resultado_recurso || null,
    valor_acordao: parseMoney(parsed.valor_acordao),
  }
}
