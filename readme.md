hucomdic
=========================
hucomdic (short for Human-Computer Dictionary) is a utility for uploading dictionary file and javascript code to the human computer dictionary. See an overview of the project here {TODO fillin}, dictionary file reference here {TODO fillin} and samples here {TODO fillin}

##Install
With [npm](https://www.npmjs.com/) do:
```
$ npm install -g hucomdic
```

##Usage
###Preparing a folder for the very first time:
```
$ hucomdic create --user {username}  --email {contributor email}
```
This command creates a new contributor account with the specified username and email. Username must a alphanumeric, starting with a letter. It may contain underscores or dashes. If successful, the command will generate a .hucomdic file with username and token properties. Make sure to ignore the .hucomdic file when commiting to git repositories or npm registries.

###Syncing Files
From within the synced folder, run the following command:

```
$ hucomdic
```

This will upload all dictionary files in the working directory and all javascript and json files in working directory and all child directories. Each .dic file created a dictionary package that can reference javascript modules and JSON files under the working directory, using require functions.


##Contribute
Please suggest enahcements and bug fixes using pull requests.

##License
Mozilla Public License, version 2.0





