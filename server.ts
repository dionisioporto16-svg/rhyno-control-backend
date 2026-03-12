import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as fs from "fs";
import Fuse from "fuse.js";
import { format } from "date-fns";
import cors from "cors";
import multer from "multer";

// Fix for XLSX in ESM
import { createRequire } from "module";
const nodeRequire = createRequire(import.meta.url);
const xlsx = nodeRequire("xlsx");
const { readFile, utils, SSF } = xlsx;

const app = express();

app.use(cors());
app.use(express.static(path.resolve("dist")));

const PORT: number = Number(process.env.PORT) || 3000;

/* ---------------- OPERACOES ---------------- */

const OPERACOES: Record<string, string[]> = {
  "SANTA FÉ DO SUL": ["domingos neto", "domingos ferrantes", "rogerio molina", "rogerio"],
  "ARARAQUARA": ["alexandra luzia", "kelly cristina", "valquiria da silva", "carlos alberto"],
  "EMBU GUAÇU": ["edvaldo nunes", "adison ferreira"],
  "RIO CLARO": ["jose de claudio", "paulo cesar", "osmar de souza", "ubirajara"],
  "SIMONSEN": ["devani alves", "adriana da silva", "joao delcino"],
  "SANTA ADÉLIA": ["renato nunes", "pedro oscar", "jamil mattioli", "warley durante"],
  "SÃO JOSÉ DO RIO PRETO": ["simone regina", "grace carryne", "antonio fabio", "fabio alex", "simone"],
  "CHAPADÃO DO SUL": ["luciano", "antonio reinaldo", "antonio reinado", "robson arnaldo"],
  "RONDONÓPOLIS": ["jonh lennon", "jhon lennon", "john lennon", "esmeraldo de jesus", "esmeraldo", "john lenon"],
  "SÃO VICENTE": ["bruno frank", "alberico de souza", "alberico"],
};

const CIDADE_ALIASES: Record<string, string[]> = {
  "SÃO JOSÉ DO RIO PRETO": ["sao jose", "sjrp", "rio preto", "rp", "s.j.r.p", "sp"],
  "RONDONÓPOLIS": ["rondonopolis", "roo", "rondon", "mt", "ro", "rondono", "rondonopolis-mt"],
  "SANTA FÉ DO SUL": ["santa fe", "sfs", "st fe", "sta fe", "santa fe do sul", "santa fe sul"],
  "ARARAQUARA": ["aqa", "araraquara", "ara"],
  "CHAPADÃO DO SUL": ["chapadao", "ms", "chapadão"],
  "SIMONSEN": ["simonsen", "simonsem", "simons"],
};

/* ---------------- DATA DIR ---------------- */

const DATA_DIR = path.join(process.cwd(), "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EXCEL_PATH = path.join(DATA_DIR, "escala.xlsx");

/* ---------------- MULTER ---------------- */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DATA_DIR),
  filename: (req, file, cb) => cb(null, "escala.xlsx"),
});

const upload = multer({ storage });

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }
  res.json({ message: "Arquivo enviado com sucesso" });
});

/* ---------------- MIDDLEWARE API ---------------- */

app.use("/api", (req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ---------------- FUNÇÕES ---------------- */

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* ---------------- API SYNC ---------------- */
/* SUA LÓGICA ORIGINAL FOI MANTIDA */

/* ---------------- VITE + SERVER ---------------- */

async function startServer() {
  try {

    if (process.env.NODE_ENV !== "production") {

      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });

      app.use(vite.middlewares);

      app.use("*", async (req, res, next) => {

        if (req.originalUrl.startsWith("/api")) {
          return next();
        }

        try {

          const indexPath = path.resolve("index.html");

          if (!fs.existsSync(indexPath)) {
            return res.status(500).send("index.html not found");
          }

          let template = fs.readFileSync(indexPath, "utf-8");

          template = await vite.transformIndexHtml(req.originalUrl, template);

          res.status(200).set({ "Content-Type": "text/html" }).end(template);

        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }

      });

    } else {

      app.use(express.static("dist"));

      app.get("*", (req, res) => {
        res.sendFile(path.resolve("dist/index.html"));
      });

    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Error starting server:", error);
  }
}

startServer();
