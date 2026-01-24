import express from "express"
import crypto from "crypto"
import { exec } from "child_process"
import path from "path"

const app = express()
app.use(express.json())

const SECRET = process.env.WEBHOOK_SECRET || "change_this"

const BASE_DIR = "/home/containers"

const projects = ["capital-crm"]

const running: Record<string, boolean> = {}

function verifyAuthorization(req: express.Request) {
    const auth = req.headers["authorization"] as string | undefined
    return auth === SECRET
}

app.post("/update/:project", (req, res) => {
    const project = req.params.project

    if (!verifyAuthorization(req)) return res.status(403).send("Invalid authorization")

    if (!projects.includes(project)) return res.status(404).send("Project not found")

    const projectDir = path.join(BASE_DIR, project)

    if (running[project]) {
        return res.status(429).send("Deployment already in progress for this project")
    }

    running[project] = true

    const cmd = `
        cd ${projectDir} &&
        git config --global --add safe.directory ${projectDir} &&
        git pull &&
        # export variables from the project's .env so compose interpolation uses them
        set -a && [ -f .env ] && . .env && set +a && \
        docker compose build &&
        docker compose up -d --force-recreate --remove-orphans &&
        docker compose ps
    `

    exec(cmd, { shell: "bash" }, (err, stdout, stderr) => {
        running[project] = false

        if (err) {
            console.error(`Error deploying ${project}:`, err)
            console.error(stderr)
            return res.status(500).send(`ERR:\n${stderr}\nSTDOUT:\n${stdout}`)
        }

        console.log(`Deployment of ${project} complete:\n`, stdout)
        res.status(200).send(`Deployment of ${project} successful:\n${stdout}\nSTDERR:\n${stderr}`)
    })
})

app.listen(process.env.PORT || 3000, () => console.log("Updater service running"))
