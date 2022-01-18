# Node SQL CLI

> *A NodeJS-based SQL command line interface which is just what you need when you don't want to install an SQL client locally.*

This package lets you connect to [any SQL server](#drivers)* and execute queries. Query results are stored in a JS VM context which you're then able to manipulate.

<small>* Interchangeable drivers not yet available. Maybe you can help flesh a generic class out?</small>

## Install

> *This package will soon be renamed to `sqlcli-repl` in the NPM registry, so try that too!*

```console
$ npm install -g sql-cli-repl
```

This package is intended to be installed globally because the idea is that it can replace all those other SQL Clients you might need, but it might be worthwhile to install it locally as a `devDependency` as well!

```console
$ npm install --save-dev sql-cli-repl
```

## Usage

Open a connection using a URI or through args
```console
$ sqlcli mysql://user:pass@localhost:3306/myDB
OR
$ sqlcli -d mysql -u user -p pass -h localhost -p 3306 -b myDB
OR
$ sqlcli -v SQL_URL -e ./.env # sqlcli -ve does the same thing!
```
Find out more help using `sqlcli --help` or `sqlcli -h`

Execute typical SQL queries:
```plain
user@localhost> SELECT 1 AS `One`, 2 AS `Two`;
|-----|-----|
| One | Two |
|-----|-----|
|   1 |   2 |
|-----|-----|
```

Execute multi-line SQL queries:
```plain
user@localhost> SELECT
... 3 AS `Three`,
... 4 AS `Four`
... ;
|-------|------|
| Three | Four |
|-------|------|
|     3 |    4 |
|-------|------|
```

Interact with the `sqlcli` environment:
```plain
user@localhost> /prompt sql
sql> /clear
sql> /prompt $reset
user@localhost> 
```

Execute JS on results:
```plain
user@localhost> SELECT 1 AS `One`, 2 AS `Two`;sh
user@localhost> >$0
[
  {
    "One": 1,
    "Two": 2
  }
]
```

## Commands

There are three (point one) types of commands that this CLI can recognise:

- [Install](#install)
- [Usage](#usage)
- [Commands](#commands)
  - [SQL Commands](#sql-commands)
    - [SQL Commands Suppressed](#sql-commands-suppressed)
  - [App Commands](#app-commands)
  - [JS Commands](#js-commands)
- [Contributing](#contributing)
  - [Drivers](#drivers)
- [License](#license)

### SQL Commands

All SQL commands are piped directly to the SQL server taht you connect to. This means that any command that you can run on an SQL server is a viable option here.

All SQL commands must terminate with a `;`, just like how you would when executing SQL commands in a script file. The only exception to this is when you want to [suppress output](#sql-commands-suppressed).

**Example:**
```plain
user@localhost> SELECT 1 AS `One`, 2 AS `Two`;
|-----|-----|
| One | Two |
|-----|-----|
|   1 |   2 |
|-----|-----|
user@localhost> 
```

#### SQL Commands Suppressed

Terminating an SQL command with `;sh` (remember 🤫) will suppess the output. Everything else about the way this command works is identical to a normal SQL command.

**Example:**
```plain
user@localhost> SELECT 1 AS `One`, 2 AS `Two`;sh
user@localhost> 
```

### App Commands

App commands allow you to interact directly with the application, such as modifying the prompt or clearing the screen, but it also lets you modify settings. These commands start with a `/` to denote that the following instructions should be handled by the application.

All available commands:
    
- `/dump [?tables...]`
  - Creates an exact copy of the tables in SQL format. If no tables are specified, this will dump all tables in the database.
  
- `/connect [driver] [user] [pass] [host] [?port]`
  - Connects to the host using the specified username and password. Disconnects from the currently connected database if not done already.
  - Port is optional, and defaults to whatever the driver defaults to.
  
- `/connectu [uri]`
  - Connects to the database at the specified URI. Determines the driver automatically. Disconnects from the currently connected database if not done already.
  
- `/connecte [variable] [?dotenvFile]`
  - Connects to the database using the URI found in the environment variable, optionally found in the DotEnv file specified.
  
- `/disconnect`
  - Disconnects from the currently connected database.
  
- `/prompt [?prompt]`
  - Prompt can be any string, and can include `$config` values or be `$reset` to reset.
  
- `/set [?setting] [?values...]`
  - Gets or sets the setting. Settings:
    - `raw active`           -- Gets the raw active setting
    - `raw active [on/off]`  -- Sets the raw active setting to on or off
    - `raw mode`             -- Gets the raw mode setting. Returns the value name
    - `raw mode [value]`     -- Sets the raw mode setting. Value must be a string
      - `values` - Values Only (default)
      - `schema` - Schema Only
      - `all` - Values and Schema
    - `nesttables`           -- Gets the nest tables prefix
    - `nesttables [prefix]`  -- Sets the nest tables prefix. Useful for removing colliding column names.
      - Use `$reset` to reset to `null`.
  
- `/clear`
  - Clears the screen.
  
- `/commands`
  - Prints out all available commands.
  
- `/help [?command]`
  - Prints this help message, or the command's specific help message.
  
- `/exit`
  - Exits the program. (Calls `SIGINT`)

### JS Commands

JS commands/instructions allow you to interact with the results of a query, such as getting the JSON of a response, or its schema, or operating directly on the results and saving them to other variables for later use. These commands start with a `>` to denote that the following instructions should be handled by the JS VM context.

Additionally, there are some global variables that allow you to retrieve past results:
  - `$` - `Array` - Returns an array of the last results received, with the latest response at index 0.
  - `$0` - `Array` - Returns the result of the last query executed. An alias for `$[0]`. To get individual results, use `$0[i]` where `i` is the row of the returned result.
  - `$$` - `Array` - Returns an array of the schemas for the last results received, with the latest response at index 0.
  - `$$0` - `Array` - Returns the schema for the last result received. An alias for `$$[0]`.

## Contributing

There are two ways to contribute: to the project, or by developing a new driver. Submit an issue, submit a PR, submit a suggestion!

### Drivers

> **Drivers are coming soon!** The information below is completely false for now. This is just here to give a heads up and to remind me that this actually needs to get done at some point!

This tool works by using [`requireg`](https://www.npmjs.com/package/requireg) to require modules following the format of `sql-cli-driver-[protocol]` (eg: [`sql-cli-driver-mysql`](https://github.com/TheBrenny/sql-cli-driver-mysql), or [`sql-cli-driver-sqlite`](https://github.com/TheBrenny/sql-cli-driver-sqlite)). If you're contributing a driver, it must expose particular methods to allow this CLI REPL tool to interact with it.

There is a [template GitHub repo](https://github.com/TheBrenny/sql-cli-driver) which has all the instructions and requirements that you need to ensure for driver.

| Database |                       Driver                       |
| :------: | :------------------------------------------------: |
|  MySQL   | https://github.com/TheBrenny/sql-cli-driver-mysql  |
|  SQLite  | https://github.com/TheBrenny/sql-cli-driver-sqlite |

## License

MIT