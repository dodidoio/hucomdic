hucomdic
========
hucomdic (short for Human-Computer Dictionary) is the basic package used to manage and interact with the human-computer dictionary. In contains two command line applications:

* [hucomdic][hucomdic] - for uploading files to the server
* [bot][bot] - for interacting with the server as a bot

For more information about the project see:
* [General Overview](https://github.com/dodidoio/hucomdic/wiki/Overview)
* [How to define a dictionary entry](https://github.com/dodidoio/hucomdic/wiki/defining-dictionaries)
* [How to build a bot](https://github.com/dodidoio/hucomdic/wiki/building-bots)

## Install
Using [npm](https://www.npmjs.com/):
```
$ npm install -g hucomdic
```

## hucomdic
hucomdic command line application uploads all files in working dir to the human-computer dictionary. It only uploads files that can be used by the human-computer dictionary, that is, files ending with .js, .json, .bot,.hook and .dic

### Initialize environment
this command will create a .dodido.json file in wokring dir with login information (such as connection token).

```
$ hucomdic init
```
After running the command, you will be prompted for username and password. 

### Uploading Files
From the envirnonment folder, where the .dodido.json file is located, run the following command:

```
$ hucomdic
```

Optionally you can specify in the command line the required directory

```
$ hucomdic -d my-hucomdic-folder
```

For command line reference type:

```
$ hucomdic --help
```

## bot command line application
The bot command line application connects with the Dodido server and interacts with it like a bot does. It is command line so its display capabilities are limited. It can be used to debug and test dictionary entries.

The bot application requires an initialized environment using the `hucomdic init` command.
From the hucomdic environment:

```
$ bot
```

Alternatively, you can specify the directory of the hucomdic environment

```
$ bot -d my-hucomdic-folder
```

A bot session will start. The bot must have some packages set so it can understand user requests. Add packages to the bot by typing:

```
+dodido/hello-world
```
This will add the package `hello-world` from the user `dodido` to the bot environment. This can be repeated to add additional packages.

Sending requests to the server is done by simply typing the request. Bot commands are preceded with a dot. For example: `.exit` for exiting the bot prompt, `.clear` for clearing the conversation context (start a new conversation), `.call` `.remove` for removing a package from the bot.

When starting a bot session for the second time, the list of packages and conversation context from previous session are used. To start a new session type

```
bot --new
```
This will start a session with no context and no defined packages.

For a command reference type:
```
bot --help
```

## Contribute
Please suggest enahcements and bug fixes using pull requests.

##License
Mozilla Public License, version 2.0
