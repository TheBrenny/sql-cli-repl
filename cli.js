require("dotenv").config();
const rl = require("readline");
const vm = require("vm"); // TODO: Create a VM and update the context to have latest responses
const mysql = require("mysql2/promise");
let bossman = require("big-kahuna").dashCare(true);
let db = Promise.resolve(null);

let config = {
    host: "localhost",
    port: 3306,
    user: "",
    password: "",
    database: "",
};

let lastRetCode = 0;

function log(obj) {
    process.stdout.write(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
}

function logn(obj) {
    log(obj);
    log("\n");
}

function logerr(err) {
    process.stderr.write(typeof err === "string" ? err : JSON.stringify(err, null, 2));
    process.stderr.write("\n");
}


async function processArgs() {
    config.uri = bossman.answer("-uri") || null;
    config.host = bossman.answer("-host") || config.host;
    config.port = bossman.answer("-port") || config.port;
    config.user = bossman.answer("-user") || config.user;
    config.password = bossman.answer("-pass", "-password") || config.password;
    config.database = bossman.answer("-database", "-db") || config.database;

    try {
        await (db = mysql.createConnection(config.uri || config));
    } catch (err) {
        // console.error(err);
        logerr(err);
        return false;
    }
    return true;
}

async function handleCommand(data) {
    if (data.startsWith("#")) {
        // do it in a different repl
        logn("JS VM coming soon...");
    } else if (data.startsWith("!")) {
        // set it with a setting
        logn("CLI settings coming soon...");
    } else {
        // execute on the server
        return (await db).query(data);
    }
    return null;
}

function processSQLResponse(records) {
    let keys = Object.keys(records[0]);
    let data = new Array(keys.length).fill(new Array(1 + records.length));
    let lengths = new Array(keys.length);

    const clampString = (clampLength, maxLength, str) => {
        clampLength = Math.min(clampLength, maxLength);
        str = str.padStart(clampLength, " ");

        if (maxLength > clampLength) str = str.substring(0, clampLength - 4) + " ...";
        else str = str.substring(0, clampLength);

        return str;
    };
    const buildRecordRow = (a, c) => a.concat(c[r]);

    for (let k = 0; k < keys.length; k++) {
        data[k][0] = keys[k];
        lengths[k] = [];
        lengths[k].push(keys[k].length);
        for (let r = 0; r < records.length; r++) {
            let rec = records[r][keys[k]];
            if (typeof rec === "object") {
                rec = JSON.parse(JSON.stringify(rec));
                rec = rec.type.substring(0, 3) + JSON.stringify(rec.data);
            }
            rec = rec.toString();

            data[k][r + 1] = rec;
            lengths[k].push(rec.length);
        }

        data[k] = data[k].map(clampString.bind(this, 40, Math.max(...lengths[k])));
    }

    let lines = [];
    for (let r = 0; r < records.length + 1; r++) {
        let line = "| " + data.reduce(buildRecordRow, []).join(" | ") + " |";
        lines.push(line);
    }

    lines.splice(1, 0, lines[0].replace(/[^|]/g, "-"));
    lines.push(lines[1]);
    return lines.join("\n");
}

function writePrompt() {
    process.stdout.write("> ");
}

function isValidCommand(c) {
    return c.endsWith(";") || c.startsWith("!") || c.startsWith("#");
}

function enterRepl() {
    let repl = rl.createInterface(process.stdin, process.stdout);

    let d = "";
    writePrompt();

    repl.on("line", (data) => {
        d += data;

        if (isValidCommand(d)) {
            Promise.resolve(d)
                .then((ret) => {
                    repl.pause();
                    return ret;
                })
                .then((ret) => handleCommand(ret))
                .then((ret) => {
                    if (ret !== null) logn(processSQLResponse(ret[0]));
                    return 0;
                })
                .catch((err) => (logerr(err), err.errno))
                .finally((retcode) => {
                    lastRetCode = retcode;
                    writePrompt();
                    repl.resume();
                });
            d = "";
        }
    }).on("SIGINT", () => process.emit("SIGINT"));
    process.on("SIGINT", () => (logn("\nBye!"), process.exit(lastRetCode)));
}

function printHelp() {
    
}

if (require.main === module) {
    if (bossman.length == 0 || bossman.has("help", "h")) printHelp();
    else {
        processArgs().then((success) => success ? enterRepl() : printHelp());
    }
} else module.exports = {};