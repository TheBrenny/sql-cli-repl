# Node SQL CLI

> *A NodeJS-based SQL command line interface which is just what you need when you don't want to install an SQL client locally.*

This package lets you connect to [any SQL server](#drivers) and execute queries. Query results are stored in a JS VM context which you're then able to manipulate.

## Install

```commandline
$ npm install -g sql-cli-repl
```

This package is intended to be installed globally as it acts as an alias for the official `mysqlcli` program, but if you find it conflicting, it might be worthwhile to install it locally as a `devDependency`.

```commandline
$ npm install --save-dev sql-cli-repl
```

## Usage

Open a connection using a URI or through args
```plain
$ sqlcli mysql://user:pass@localhost:3306/myDB
OR
$ sqlcli -u user -p pass -h localhost -db myDB
```
Find out more help using `sqlcli --help`

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
```

Interact with the app/cli
```plain
user@localhost> /prompt sql
sql> /clear
sql> /prompt $reset
user@localhost> 
```

Execute JS on results
```plain
user@localhost> SELECT 1 AS `One`, 2 AS `Two`;
user@localhost> >$0

```

## Commands

There are three (point one) types of commands that this CLI can recognise:
- [Node SQL CLI](#node-sql-cli)
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
- `/clear` - Clears the screen
- `/prompt [...p]` - Sets the prompt to your passed value `p` (automatically adds the `> `)
  - `/prompt` - Ommitting `p` will display the current prompt value
  - There are a number of `$` values that can be used as `p`:
    - `$reset` - If passed by itself, this will reset the prompt to the default value (`$user@$host`)
    - `$[config]` - Inserts the config option (user, host, pass, port, db, etc...)
- `/set <setting> [...opts]` - Sets or shows the settings of the application. The following settings are available:
  - `/set raw [opt] [val]`
    - Without `val` shows either the whole raw mode setting or the specific raw mode setting. With `val` it sets the setting
    - `opt` can be either `mode` or `active`
    - More help can be found by calling `!help`
- `/dump [...tables]` - Dumps the SQL statements for the whole database, so it can be recreated elsewhere
  - `[...tables]` allows you to specify specific tables to dump
- ***TO BE ADDED***
- `/save [opt]` Saves data about the session to the PWD
  - `/save session` Saves only the commands and results called
  - `/save settings` Saves the current settings of the application
  - `/save all` Saves the entire session (commands and settings)

### JS Commands

JS commands/instructions allow you to interact with the results of a query, such as getting the JSON of a response, or its schema, or operating directly on the results and saving them to other variables for later use. These commands start with a `>` to denote that the following instructions should be handled by the JS VM context.

Additionally, there are some global variables that allow you to retrieve past results:
  - `$` - `Array` - Returns an array of the last results received, with the latest response at index 0.
  - `$0` - `Object` - Returns the result of the last query executed. An alias for `$[0]`.
  - `$$` - `Array` - Returns an array of the schemas for the last results received, with the latest response at index 0.
  - `$$0` - `Object` - Returns the schema for the last result received. An alias for `$$[0]`.

## Contributing

There are two ways to contribute: to the project, or by developing a new driver. Submit an issue, submit a PR, submit a suggestion!

### Drivers

This tool works by using [`requireg`](https://www.npmjs.com/package/requireg) to require modules following the format of `sql-cli-driver-[protocol]` (eg: [`sql-cli-driver-mysql`](https://github.com/TheBrenny/sql-cli-driver-mysql), or [`sql-cli-driver-sqlite`](https://github.com/TheBrenny/sql-cli-driver-sqlite)). If you're contributing a driver, it must expose particular methods to allow this CLI REPL tool to interact with it.

There is a [template GitHub repo](https://github.com/TheBrenny/sql-cli-driver) which has all the instructions and requirements that you need to ensure for driver.

## License

MIT