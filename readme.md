# Node MySQL CLI

> *A NodeJS-based MySQL CLI client which is just what you need when you don't want to install MySQL locally.*

This package lets you connect to a MySQL server and execute queries. Query results are stored in a JS VM context which you're then able to manipulate.

## Install

```commandline
$ npm install -g mysqlcli
```

This package is intended to be installed globally as it acts as an alias for the official `mysqlcli` program, but if you find it conflicting, it might be worthwhile to install it locally as a `devDependency`.

```commandline
$ npm install --save-dev mysqlcli
```

## Usage

Open a connection using a URI or through args
```plain
$ mysqlcli mysql://user:pass@localhost:3306/myDB
OR
$ mysqlcli -u user -p pass -h localhost -db myDB
```
Find out more help using `mysqlcli -help`

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

Change (and reset) the prompt and 
```plain
user@localhost> !prompt sql
sql> SELECT 1 AS `One`, 2 AS `Two`;
                .......
sql> !prompt
user@localhost> 
```

Clear the screen
```plain
user@localhost> !clear
```