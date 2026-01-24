import express from "express"
import crypto from "crypto"
import { exec } from "child_process"
import path from "path"

const app = express()
app.use(
    express.json({
        verify: (req: any, _res, buf: Buffer) => {
            req.rawBody = buf
        },
    }),
)
// Capture raw body for application/x-www-form-urlencoded payloads too
app.use(
    express.urlencoded({
        extended: true,
        verify: (req: any, _res, buf: Buffer) => {
            req.rawBody = buf
        },
    }),
)

const SECRET = process.env.WEBHOOK_SECRET || "change_this"

const BASE_DIR = "/home/containers"

const projects = ["capital-crm", "updater"]

const running: Record<string, boolean> = {}

function verifySignature(req: express.Request) {
    const signature = req.headers["x-hub-signature-256"] as string | undefined
    const raw = (req as any).rawBody as Buffer | undefined

    if (!signature || !raw) return false

    const hmac = `sha256=${crypto.createHmac("sha256", SECRET).update(raw).digest("hex")}`

    try {
        const sigBuf = Buffer.from(signature)
        const hmacBuf = Buffer.from(hmac)
        if (sigBuf.length !== hmacBuf.length) return false
        return crypto.timingSafeEqual(sigBuf, hmacBuf)
    } catch (e) {
        return false
    }
}

app.post("/update/:project", (req, res) => {
    const project = req.params.project

    if (!verifySignature(req)) return res.status(403).send("Invalid signature")

    if (!projects.includes(project)) return res.status(404).send("Project not found")

    const projectDir = path.join(BASE_DIR, project)

    if (running[project]) {
        return res.status(429).send("Deployment already in progress for this project")
    }

    running[project] = true

    if (project === "updater") {
        // Send immediate response before updating self
        res.status(200).send("Updater is updating itself. It will be back shortly.")
    }

    const cmd = `
        cd ${projectDir} &&
        git config --global --add safe.directory ${projectDir} &&
        git pull &&
        # export variables from the project's .env so compose interpolation uses them
        set -a && [ -f .env ] && . .env && set +a && \
        docker compose build &&
        docker compose up -d --force-recreate --remove-orphans
    `

    exec(cmd, { shell: "bash" }, (err, stdout, stderr) => {
        running[project] = false

        if (err) {
            console.error(`Error deploying ${project}:`, err)
            console.error(stderr)
            if (!res.headersSent) {
                return res.status(500).send(`ERR:\n${stderr}\nSTDOUT:\n${stdout}`)
            }
            return
        }

        console.log(`Deployment of ${project} complete:`)
        if (!res.headersSent) {
            res.status(200).send(`Deployment of ${project} successful:\n${stdout}\nSTDERR:\n${stderr}`)
        }
    })
})

app.listen(process.env.PORT || 3000, () => console.log("Updater service running"))
