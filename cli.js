require("dotenv").config();
const rl = require("readline");
const vm = require("vm"); // TODO: Create a VM and update the context to have latest responses
const $ = [];
const $s = [];
const vmContext = vm.createContext();
Object.defineProperties(vmContext, {
    $: {
        get: () => Array.from($)
    },
    $0: {
        get: () => Object.values(Object.assign({}, Array.from($)[0]))
    },
    $s: {
        get: () => Array.from($s)
    },
    $s0: {
        get: () => Object.values(Object.assign({}, Array.from($s)[0]))
    },
});
const mysql = require("mysql2/promise");
const chalk = require("chalk");
const url = require("url");
const rawModes = {
    "all": 0b11,
    "schema": 0b10,
    "values": 0b01,
};

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
let settings = {
    prompt: "mysql",
    raw: {
        active: false,
        mode: rawModes.values
    },
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
    if (err instanceof Error) {
        err = {
            name: err.name,
            errno: err.code || -1,
            message: err.message,
            stack: err.stack || "no stack"
        };
    }
    process.stderr.write(typeof err === "string" ? err : JSON.stringify(err, null, 2).replace(/\\n/g, "\n").replace(/\\\\/g, "\\"));
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
        db = null;
    }
}

async function handleCommand(data) {
    if (data.startsWith("#")) {
        // do it in a different repl
        return handleJsInstruction(data.substring(1));
    } else if (data.startsWith("!")) {
        // set it with a setting
        return handleAppCommand(data.substring(1));
    } else {
        // execute on the server
        if (db === null) throw {
            message: "DB not connected.",
            code: "DBDISCON",
            errno: 12
        };
        let suppress = data.endsWith("sh");
        if (suppress) data = data.substring(0, data.length - 2);
        let r = await (await db).query(data);
        $.splice(0, 0, r[0]);
        $s.splice(0, 0, r[1]);
        if (settings.raw.active) return settings.raw.mode == rawModes.all ? r : settings.raw.mode == rawModes.schema ? r[1] : r[0];
        else if (!suppress) return handleSQLResponse(r[0]);
        else return null;
    }
}

function handleJsInstruction(inst) {
    // logn(chalk.italic.blue("JS VM coming soon..."));
    try {
        let ret = vm.runInContext(inst, vmContext, {
            displayErrors: true,
            breakOnSigint: true,
        });
        return ret;
    } catch (err) {
        logerr(err);
    }
}

function handleAppCommand(cmd) {
    let ret = null;
    let err = null;

    cmd = cmd.split(" ");
    switch (cmd[0].toLowerCase()) {
        case "prompt":
            if (cmd.length == 1 || cmd[1].trim() == "") ret = `Current Prompt: ${settings.prompt}`;
            else {
                if (cmd[1].toLowerCase() == "$reset") setDefaultPrompt();
                else setPrompt(cmd.slice(1).map(c => c.startsWith("$") ? config[c.substr(1)] : c).join(" "));
                ret = "Prompt updated!";
            }
            break;
        case "set":
            let setting = cmd[1].toLowerCase();
            let subsetting = (cmd[2] || "").toLowerCase();
            switch (setting) {
                case "raw":
                    if (cmd.length < 3 || subsetting == "") {
                        ret = [`Raw active: ${settings.raw.active ? "on" : "off"}`, `Raw mode: ${settings.raw.mode}`];
                        break;
                    }
                    switch (subsetting) {
                        case "active":
                            if (cmd.length < 4 || cmd[3].trim() == "") ret = `Raw active: ${settings.raw.active ? "on" : "off"}`;
                            else {
                                settings.raw.active = cmd[3].trim().toLowerCase() == "true";
                                ret = `Raw active ${settings.raw.active ? "on" : "off"}`;
                            }
                            break;
                        case "mode":
                            if (cmd.length < 4 || cmd[3].trim() == "") ret = `Raw mode: ${settings.raw.mode}`;
                            else {
                                settings.raw.mode = rawModes[cmd[3].trim().toLowerCase()] || rawModes.values;
                                ret = `Raw mode ${settings.raw.mode}`;
                            }
                            break;
                        default:
                            err = {
                                message: "Unknown raw setting: " + cmd[2],
                                code: "NULLAPPSET",
                                errno: 110
                            };
                            break;
                    }
                    break;
                default:
                    err = {
                        message: "Unknown app setting: " + cmd[1],
                        code: "NULLAPPSET",
                        errno: 110
                    };
            }
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
            err = {
                message: "Unknown app command: " + cmd,
                code: "NULLAPPCMD",
                errno: 100
            };
    }
    if (!Array.isArray(ret) && ret !== null) ret = [ret];
    if (err != null) throw err;
    else return ret === null ? null : ret.map(r => chalk.italic.green("  " + r)).join("\n");
}

function handleSQLResponse(records) {
    if (records.length == 0) return "Returned 0 rows.";
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
            if (rec === null || rec === undefined) rec = "null";
            if (typeof rec === "object") {
                rec = JSON.parse(JSON.stringify(rec));
                rec = (rec.type || "???????").substring(0, 3) + JSON.stringify(rec.data);
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

function isValidCommand(c) {
    return c.endsWith(";") || c.endsWith(";sh") || // SQL command
        c.startsWith("!") || // internal command
        c.startsWith("#"); // js command
}

async function setDefaultPrompt() {
    setPrompt(db === null ? chalk.bold.red(`disconnected`) : `${chalk.bold.green(config.user)}@${config.host}`);
}

function setPrompt(p) {
    settings.prompt = p;
    repl.setPrompt(`${p}> `);
}

function enterRepl() {
    repl = rl.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: settings.prompt + "> "
    });
    setDefaultPrompt();

    let d = "";
    let p = null;

    repl.prompt();
    repl.on("line", (data) => {
        data = data.trim();
        d += data;

        if (isValidCommand(d)) {
            Promise.resolve(d)
                .then((ret) => {
                    if (p !== null) setPrompt(p);
                    p = null;
                    repl.pause();
                    return ret;
                })
                .then((ret) => handleCommand(ret))
                .then((ret) => {
                    if (ret !== null) logn(ret);
                    return 0;
                })
                .catch((err) => {
                    logerr(err);
                    return err.errno;
                })
                .finally((retcode) => {
                    lastRetCode = retcode;
                    repl.prompt();
                    repl.resume();
                });
            d = "";
        } else if (d != "") {
            d += " ";
            if (p === null) p = settings.prompt;
            repl.setPrompt("... ");
            repl.prompt();
        } else {
            repl.prompt();
        }
    }).on("SIGINT", () => process.emit("SIGINT"));
    process.on("SIGINT", () => {
        if (d === "") {
            logn("\nBye!");
            process.exit(lastRetCode);
        } else {
            d = "";
            if (p !== null) setPrompt(p);
            p = null;
            log("\n");
            repl.emit("line", "");
        }
    });
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