import express from "express"
import cors from "cors"
import multer from "multer"
import path from "path"
import fs from "fs"
import Fuse from "fuse.js"

import { createRequire } from "module"
const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const app = express()

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000

/* -------------------------
   Pasta onde ficará o Excel
------------------------- */

const DATA_DIR = path.join(process.cwd(), "data")

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const EXCEL_PATH = path.join(DATA_DIR, "escala.xlsx")

/* -------------------------
   Upload da planilha
------------------------- */

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, DATA_DIR)
  },
  filename: (_, __, cb) => {
    cb(null, "escala.xlsx")
  }
})

const upload = multer({ storage })

/* -------------------------
   Operações
------------------------- */

const OPERACOES: Record<string, string[]> = {
  "SANTA FÉ DO SUL": ["domingos neto", "domingos ferrantes", "rogerio molina"],
  "ARARAQUARA": ["alexandra luzia", "kelly cristina", "valquiria da silva"],
  "EMBU GUAÇU": ["edvaldo nunes", "adison ferreira"],
  "RIO CLARO": ["jose de claudio", "paulo cesar", "osmar de souza"],
  "SIMONSEN": ["devani alves", "adriana da silva", "joao delcino"]
}

/* -------------------------
   Utils
------------------------- */

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

/* -------------------------
   API
------------------------- */

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" })
})

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "nenhum arquivo enviado" })
  }

  res.json({ message: "planilha enviada com sucesso" })
})

/* -------------------------
   Sincronizar planilha
------------------------- */

app.get("/api/sync", (_, res) => {

  if (!fs.existsSync(EXCEL_PATH)) {
    return res.status(404).json({
      error: "planilha não encontrada"
    })
  }

  const workbook = XLSX.readFile(EXCEL_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]

  const data = XLSX.utils.sheet_to_json(sheet)

  const motoristas = data.map((row: any) => ({
    nome: normalize(row.nome || row.motorista || ""),
    cidade: normalize(row.cidade || "")
  }))

  const results = Object.entries(OPERACOES).map(([cidade, nomes]) => {

    const fuse = new Fuse(motoristas, {
      keys: ["nome"],
      threshold: 0.4
    })

    for (const nome of nomes) {

      const match = fuse.search(normalize(nome))

      if (match.length > 0) {
        return {
          cidade,
          motorista: match[0].item.nome,
          encontrado: true
        }
      }

    }

    return {
      cidade,
      motorista: null,
      encontrado: false
    }

  })

  res.json({
    total: motoristas.length,
    results
  })

})

/* -------------------------
   Start
------------------------- */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API rodando na porta ${PORT}`)
})
