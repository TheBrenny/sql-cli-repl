#!/usr/bin/env node

const args = require('yargs')
    .scriptName("sqlcli")
    .showHelpOnFail(true)
    .command("$0", "Create an SQL CLI that is disconnected to begin with", (y) => {
        y.options({
            "username": {
                alias: ["user", "u"],
                string: true,
            },
            "password": {
                alias: ["pass", "p"],
                string: true,
            },
            "host": {
                alias: ["h"],
                string: true,
            },
            "port": {
                number: true,
            },
            "database": {
                alias: ["db"],
                string: true,
            },
            "driver": {
                alias: ["d"],
                string: true,
            }
        });
    })
    .command("<uri>", "Connect to a DB using a URI", (y) => {
        y.positional("uri", {
            desc: "URI to a DB server to connect to",
            type: "string",
            conflicts: ["username", "password", "host", "port", "database"]
        });
    });

const requireg = require("requireg");
const rl = require("readline");
const vm = require("vm");
const $ = [];
const $$ = [];
const vmContext = vm.createContext();
Object.defineProperties(vmContext, {
    $: {
        get: () => Array.from($)
    },
    $0: {
        get: () => Object.values(Object.assign({}, Array.from($)[0]))
    },
    $$: {
        get: () => Array.from($$)
    },
    $$0: {
        get: () => Object.values(Object.assign({}, Array.from($$)[0]))
    },
});
const mysql = require("mysql2/promise");
const chalk = require("chalk");
const url = require("url");
const yargs = require('yargs');
const rawModes = {
    "all": 0b11,
    "schema": 0b10,
    "values": 0b01,
};

let db = null;
let repl = null;

let config = {
    host: null,
    port: null,
    user: null,
    password: null,
    database: null,
    driver: null,
};
let settings = {
    prompt: "mysql",
    raw: {
        active: false,
        mode: rawModes.values,
        getMode: (v) => Object.keys(rawModes).find(e => rawModes[e] == (v || settings.raw.mode))
    },
    nestTables: null,
    saveCount: 20
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
            code: err.code || -1,
            message: err.message,
            stack: err.stack || "no stack"
        };
    }
    // TODO: Pretty print the errors
    process.stderr.write(typeof err === "string" ? err : JSON.stringify(err, null, 2).replace(/\\n/g, "\n").replace(/\\\\/g, "\\"));
    process.stderr.write("\n");
}

async function processArgs() {
    let args = yargs.argv;
    config.uri = args._[0] || null;
    config.host = args.host || config.host;
    config.port = args.port || config.port;
    config.user = args.username || config.user;
    config.password = args.password || config.password;
    config.database = args.database || config.database;
    config.driver = args.driver || config.driver;

    try {
        if (config.uri) {
            let obj = url.parse(config.uri);
            config.host = obj.hostname;
            config.port = obj.port;
            [config.user, config.password] = obj.auth.split(":");
            config.database = obj.pathname.substr(1);
        }

        if (config.uri || config.host) await (connectToDB(config.uri || config));
    } catch (err) {
        logerr(err);
        db = null;
    }
}

async function connectToDB(opts) {
    try {
        let driver;
        if (typeof opts === "string") {
            let obj = url.parse(opts);
            opts = {};
            opts.host = obj.hostname;
            opts.port = obj.port;
            [opts.user, opts.password] = obj.auth.split(":");
            opts.database = obj.pathname.substr(1);
            driver = obj.protocol.substring(0, obj.protocol.length - 1);
        } else {
            driver = opts.driver;
        }
        // TODO: This is where `requirereg` is needed to make sure that we can accomodate the passed driver
        // TODO: We need to make this actually work better. I need to create some form of documentation which
        //       dictates how drivers need to be made!!
        switch (driver) {
            case "mysql":
                driver = mysql;
                break;
            default:
                throw {
                    message: `Bad protocol must be '${driver}'.`,
                        name: "BADURI",
                        code: 11
                };
        }
        return (db = await driver.createConnection(opts));
    } catch (err) {
        logerr(err);
        db = null;
    }
}

async function handleCommand(data) {
    if (data.startsWith(">")) {
        // do it in a different repl
        return await handleJsInstruction(data.substring(1));
    } else if (data.startsWith("/")) {
        // set it with a setting
        return await handleAppCommand(data.substring(1));
    } else {
        // execute on the server
        if (db === null) throw {
            message: "DB not connected.",
            name: "DBDISCON",
            code: 12
        };

        let suppress = data.endsWith("sh");
        if (suppress) data = data.substring(0, data.length - 2);

        let r = await db.query({
            sql: data,
            nestTables: settings.nestTables
        });
        $.splice(0, 0, r[0]);
        $.splice(settings.saveCount, $.length - settings.saveCount);
        $$.splice(0, 0, r[1]);
        $$.splice(settings.saveCount, $$.length - settings.saveCount);

        if (settings.raw.active && !suppress) return settings.raw.mode == rawModes.all ? r : settings.raw.mode == rawModes.schema ? r[1] : r[0];
        else if (!suppress) return r[1] != null ? handleSQLResponse(r[0]) : handleSQLModify(r[0]);
        else return null;
    }
}

function handleJsInstruction(inst) {
    try {
        let ret = vm.runInContext(inst, vmContext, {
            displayErrors: true,
            breakOnSigint: true,
        });
        if (ret === undefined && inst.trim().startsWith("let")) {
            ret = vm.runInNewContext(inst.trim().split(/ +/)[1], vmContext);
            if (ret === undefined) ret = chalk.italic.grey("undefined...");
        }
        return ret;
    } catch (err) {
        logerr(err);
    }
}

const appCommands = {
    "_": {
        "commands": [
            "Prints out all available commands."
        ],
        "connect": [
            "[driver] [user] [pass] [host] [?port]",
            "Connects to the host using the specified username and password. Disconnects from the currently connected database if not done already.",
            "Port is optional, and defaults to whatever the driver defaults to."
        ],
        "connectu": [
            "[uri]",
            "Connects to the database at the specified URI. Determines the driver automatically. Disconnects from the currently connected database if not done already.",
        ],
        "disconnect": [
            "Disconnects from the currently connected database."
        ],
        "prompt": [
            "[?prompt]",
            "Prompt can be any string, and can include $config values or be $reset to reset"
        ],
        "set": [
            "[?setting] [?values...]",
            "Gets or sets the setting. Settings:",
            "raw active           -- Gets the raw active setting",
            "raw active [on/off]  -- Sets the raw active setting to on or off",
            "raw mode             -- Gets the raw mode setting. Returns the value name",
            "raw mode [value]     -- Sets the raw mode setting. Value must be a number",
            "    1 - Values Only (default)",
            "    2 - Schema Only",
            "    3 - Values and Schema",
            "nesttables           -- Gets the nest tables prefix",
            "nesttables [prefix]  -- Sets the nest tables prefix. Useful for removing colliding column names.",
            "    Use $reset to reset to null.",
        ],
        "dump": [
            "[?tables...]",
            "Creates an exact copy of the tables in SQL format. If no tables are specified, this will dump all tables in the database."
        ],
        "clear": [
            "Clears the screen"
        ],
        "help": [
            "[?command]",
            "Prints this help message"
        ],
        "exit": [
            "Exits the program. (Calls SIGINT)"
        ]
    },
    async dump(...tables) {
        let exec = async (sql) => await db.query(sql);
        tables = tables.length > 0 ? Array.from(tables) : (await exec("show tables"))[0].map(e => Object.values(e)[0]);

        let dump = ["-- Dump created by SQLCLI by TheBrenny // https://github.com/thebrenny/sql-cli-repl --", ""];
        let miniDump = [];
        let ret = {};

        for (let t of tables) {
            ret = (await exec("show create table " + t))[0][0];
            dump.push("-- " + ret["Table"] + " --"); // jshint ignore:line
            dump.push(ret["Create Table"]);
            dump.push("");

            ret = (await exec("select * from " + t));
            if (ret[0][0] !== undefined) {
                let qmark = Object.keys(ret[0][0]).map(() => "?").join(", ");
                dump.push(mysql.format(`INSERT INTO ${t} (${qmark}) VALUES`, Object.keys(ret[0][0])));
                miniDump = [];
                for (let r of ret[0]) {
                    miniDump.push("    " + mysql.format(`(${qmark})`, Object.values(r)));
                }
                dump.push(miniDump.join(",\n"));
                dump[dump.length - 1] += ";";
                dump.push("");
            }
        }

        dump.push("", "-- Dump created by SQLCLI by TheBrenny // https://github.com/thebrenny/sql-cli-repl --");
        return dump.join("\n");
    },
    async connect(driver, user, pass, host) {
        let opts = {
            host,
            user,
            password: pass
        };
        await connectToDB(opts);
        setDefaultPrompt();
        return null;
    },
    async connectu(uri) {
        await connectToDB(uri);
        setDefaultPrompt();
        return null;
    },
    disconnect() {
        db.end();
        db = null;
        setDefaultPrompt();
        return null;
    },
    prompt(...p) {
        if (p.length == 0 || p.join("").trim() == "") return `Current Prompt: ${settings.prompt}`;

        if (p[0].toLowerCase() == "$reset") setDefaultPrompt();
        else {
            for (let c in config) p = p.map(v => v.replace(new RegExp("\\$" + c, "gi"), config[c])); //jshint ignore:line
            setPrompt(p.join(" "));
        }

        return "Prompt updated!";
    },
    set(...v) {
        let key = v[0];
        let values = v.slice(1);
        switch (key) {
            case "raw":
                if (values.length == 0) return [`Raw active: ${settings.raw.active ? "on" : "off"}`, `Raw mode: ${settings.raw.getMode()}`];
                switch (values[0]) {
                    case "active":
                        if (values.length == 1) return `Raw active: ${settings.raw.active ? "on" : "off"}`;

                        settings.raw.active = ["true", "on"].includes(values[1].trim().toLowerCase());
                        return `Raw active ${settings.raw.active ? "on" : "off"}`;
                    case "mode":
                        if (values.length == 1) return `Raw mode: ${settings.raw.getMode()}`;

                        settings.raw.mode = rawModes[values[1].trim().toLowerCase()] || rawModes.values;
                        return `Raw mode ${settings.raw.getMode()}`;
                    default:
                        ret = {
                            message: "Unknown raw setting: " + values[0],
                            name: "NULLAPPSET",
                            code: 110
                        };
                        return ret;
                }
                break;
            case "nesttables":
                if (values.length == 0) return `Nest tables: ${settings.nestTables ? "on" : "off"}`;

                if (values == "$reset") settings.nestTables = null;
                else settings.nestTables = values[0];

                return `Nest tables ${settings.nestTables || "off"}`;
            default:
                ret = {
                    message: "Unknown app setting: " + key,
                    name: "NULLAPPSET",
                    code: 110
                };
                return ret;
        }
    },
    clear() {
        process.stdout.cursorTo(0, 0);
        process.stdout.clearScreenDown();
        return null;
    },
    commands() {
        return Object.keys(appCommands).filter(c => c !== "_");
    },
    help: printHelp,
    exit() {
        process.emit("SIGINT");
    },
};
async function badCommand(cmd) {
    return chalk.italic.red("Unknown command: \"" + cmd + "\"");
}

async function handleAppCommand(cmd) {
    let ret = null;

    cmd = cmd.split(" ");
    if (cmd[0] !== "_" && !!appCommands[cmd[0]]) ret = await appCommands[cmd[0]](...cmd.slice(1));
    else return (await badCommand(cmd));

    if (ret !== null && ret.code !== undefined) throw ret;
    if (!Array.isArray(ret) && ret !== null) ret = [ret];

    return (ret === null ? null : ret.map(r => chalk.italic.green("  " + r)).join("\n"));
}

function handleSQLResponse(records) {
    if (records.length == 0) return "Returned " + chalk.yellow("0") + " rows.";
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
            if (rec instanceof Date) rec = rec.toJSON();
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

function handleSQLModify(record) {
    let id = record.insertId;
    let rows = record.affectedRows;

    if (id == 0) return "Deleted " + chalk.yellow(rows) + " record" + (rows == 1 ? "" : "s") + ".";
    else return "Altered " + chalk.yellow(rows) + " record" + (rows == 1 ? "" : "s") + ".";
}

function isValidCommand(c) {
    return c.endsWith(";") || c.endsWith(";sh") || // SQL command
        c.startsWith("/") || // internal command
        c.startsWith(">"); // js command
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
                    return err.code;
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

function printHelp(cmd) {
    let h = [""];

    for (let c in appCommands) {
        if (c === "_") continue;
        if (!!cmd && c !== cmd) continue;
        h.push("/" + c);
        h = h.concat(appCommands._[c].map(v => "  " + v));
        h.push("");
    }

    return h.map(v => "  " + v).join("\n");
}

if (require.main === module) {
    if (yargs.argv.help) yargs.showHelp();
    else processArgs().then(enterRepl).catch(logerr);
} else module.exports = {};