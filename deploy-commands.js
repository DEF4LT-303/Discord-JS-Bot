require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const adminCommands = [];

// Define the admin guilds from the environment variable
const adminGuildIds = process.env.ADMIN_GUILD_IDS.split(',');

// Grab all the command folders from the commands directory
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  // Grab all the command files from each folder
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      if (folder === 'admin') {
        // Add to admin commands if it belongs to the admin folder
        adminCommands.push(command.data.toJSON());
      } else {
        // Add to regular commands otherwise
        commands.push(command.data.toJSON());
      }
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.BOT_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length + adminCommands.length} application (/) commands.`
    );

    const guildIds = process.env.GUILD_ID.split(',');

    for (const guildId of guildIds) {
      // Deploy regular commands to all guilds
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId.trim()),
        { body: commands }
      );
      console.log(
        `Successfully deployed ${commands.length} commands to guild ${guildId}.`
      );
    }

    for (const adminGuildId of adminGuildIds) {
      // Deploy admin commands only to admin guilds
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          adminGuildId.trim()
        ),
        { body: [...commands, ...adminCommands] } // Combine regular and admin commands
      );
      console.log(
        `Successfully deployed ${commands.length + adminCommands.length} commands to admin guild ${adminGuildId}.`
      );
    }
  } catch (error) {
    console.error(error);
  }
})();
