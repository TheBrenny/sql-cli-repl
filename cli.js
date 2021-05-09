require("dotenv").config();
const rl = require("readline");
const vm = require("vm"); // TODO: Create a VM and update the context to have latest responses
const mysql = require("mysql2/promise");
const chalk = require("chalk");
const url = require("url");
let bossman = require("big-kahuna").dashCare(true);
let db = null;
let repl = null;
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
    config.uri = bossman.cabinet(0) || null;
    config.host = bossman.answer("-host", "-h") || config.host;
    config.port = bossman.answer("-port") || config.port;
    config.user = bossman.answer("-user", "-u") || config.user;
    config.password = bossman.answer("-pass", "-p") || config.password;
    config.database = bossman.answer("-database", "-db") || config.database;

    try {
        if (config.uri) {
            let obj = url.parse(config.uri);
            if (!obj.protocol.startsWith("mysql")) throw {
                message: "Bad MySQL URI. Protocol must be 'mysql://'.",
                code: "BADURI",
                errno: 11
            };
            config.host = obj.hostname;
            config.port = obj.port;
            [config.user, config.password] = obj.auth.split(":");
            config.database = obj.pathname.substr(1);
        }

        await (db = mysql.createConnection(config.uri || config));
    } catch (err) {
        logerr(err);
    }
}

async function handleCommand(data) {
    if (data.startsWith("#")) {
        // do it in a different repl
        handleJsInstruction(data.substring(1));
    } else if (data.startsWith("!")) {
        // set it with a setting
        handleAppCommand(data.substring(1));
    } else {
        // execute on the server
        if (db === null) throw {
            message: "DB not connected.",
            code: "DBDISCON",
            errno: 12
        };
        let r = await (await db).query(data);
        return handleSQLResponse(r[0]);
    }
    return null;
}

function handleJsInstruction(inst) {
    logn(chalk.italic.blue("JS VM coming soon..."));
}

function handleAppCommand(cmd) {
    let ret = {};

    cmd = cmd.split(" ");
    switch (cmd[0].toLowerCase()) {
        case "prompt":
            if (cmd.length == 1 || cmd[1].trim() == "") setDefaultPrompt();
            else {
                setPrompt(
                    cmd
                    .slice(1)
                    .map(c => c.startsWith("$") ? config[c.substr(1)] : c)
                    .join(" ")
                );
            }
            ret = "Prompt updated!";
            break;
        case "clear":
            process.stdout.cursorTo(0, 0);
            process.stdout.clearScreenDown();
            break;
        case "exit":
        case "quit":
            process.emit("SIGINT");
            break;
        default:
            ret.err = {
                message: "Unknown app command: " + cmd,
                code: "NULLAPPCMD",
                errno: 10
            };
    }
    if (ret.err != null) throw ret.err;
    else return ret;
}

function handleSQLResponse(records) {
    let keys = Object.keys(records[0]);
    let data = new Array(keys.length).fill(new Array(1 + records.length));
    let lengths = new Array(keys.length);


    const clampString = (clampLength, maxLength, str) => {
        clampLength = Math.min(clampLength, maxLength);
        str = str.padStart(clampLength, " ");

        if (str.length > clampLength) str = str.substring(0, clampLength - 4) + " ...";
        else str = str.substring(0, clampLength);

        return str;
    };
    const buildRecordRow = (r, a, c) => a.concat(c[r]);


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
        let line = "| " + data.reduce(buildRecordRow.bind(null, r), []).join(" | ") + " |";
        lines.push(line);
    }

    lines.splice(1, 0, lines[0].replace(/[^|]/g, "-"));
    lines.splice(0, 0, lines[0].replace(/[^|]/g, "-"));
    lines.push(lines[0]);
    return lines.join("\n");
}

// function writePrompt() {
//     process.stdout.write(config.prompt + "> ");
// }

function isValidCommand(c) {
    return c.endsWith(";") || // SQL command
        c.startsWith("!") || // internal command
        c.startsWith("#"); // js command
}

async function setDefaultPrompt() {
    setPrompt(db === null ? chalk.bold.red(`disconnected`) : `${chalk.bold.green(config.user)}@${config.host}`);
}

function setPrompt(p) {
    repl.setPrompt(`${p}> `);
}

function enterRepl() {
    repl = rl.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "mysql> "
    });
    setDefaultPrompt();
    repl.prompt();

    let d = "";
    let p = null;

    repl.on("line", (data) => {
        d += data;

        if (isValidCommand(d)) {
            Promise.resolve(d)
                .then((ret) => {
                    if (p !== null) repl.setPrompt(p);
                    p = null;
                    repl.pause();
                    return ret;
                })
                .then((ret) => handleCommand(ret))
                .then((ret) => {
                    if (ret !== null) logn(ret);
                    return 0;
                })
                .catch((err) => (logerr(err), err.errno))
                .finally((retcode) => {
                    lastRetCode = retcode;
                    repl.prompt();
                    repl.resume();
                });
            d = "";
        } else if (d != "") {
            // console.log(repl);
            d += " ";
            if (p === null) p = repl._prompt;
            repl.setPrompt("... ");
            repl.prompt();
        } else {
            repl.prompt();
        }
    }).on("SIGINT", () => process.emit("SIGINT"));
    process.on("SIGINT", () => (logn("\nBye!"), process.exit(lastRetCode)));
}

function printHelp() {
    let help = [
        "Connects to a MySQL server and allows the user to enter SQL and JS commands.",
        "",
        "mysqlcli {MYSQL_URI | OPTIONS}",
        "    MYSQL_URI must be a properly formatted MySQL server URI with protocol, auth, host, port, and pathnames set.",
        "    OPTIONS:",
        "      -help ........... Prints this help message",
        "      -u, -user ....... Sets the user to connect as",
        "      -p, -pass ....... Sets the password to use when connecting",
        "      -h, -host ....... Sets the host to connect to",
        "      -port ........... Sets the port to use",
        "      -db, -database .. Sets the database to connect to",
        "",
        "Example:",
        "    mysqlcli mysql://user:pass@localhost:3306/myDB"
    ];
    console.log(help.join("\n"));
}

if (require.main === module) {
    if (bossman.has("-help")) printHelp();
    else processArgs().then(enterRepl).catch(logerr);
} else module.exports = {};