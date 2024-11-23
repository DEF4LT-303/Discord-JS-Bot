const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  cooldown: 5,
  category: 'utility',
  data: (() => {
    // Dynamically add all command names as choices for the 'command' option
    const commandsPath = path.join(__dirname, '../');
    const commandFolders = fs.readdirSync(commandsPath);
    const commandNames = [];

    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      const commandFiles = fs
        .readdirSync(folderPath)
        .filter((file) => file.endsWith('.js'));

      for (const file of commandFiles) {
        const command = require(path.join(folderPath, file));
        if ('data' in command) {
          commandNames.push(command.data.name);
        }
      }
    }

    const commandBuilder = new SlashCommandBuilder()
      .setName('help')
      .setDescription(
        'Lists all available commands or details about a specific command.'
      )
      .addStringOption((option) => {
        const optionBuilder = option
          .setName('command')
          .setDescription('The command to get detailed help for');

        // Dynamically add choices from commandNames
        commandNames.forEach((name) => {
          optionBuilder.addChoices({ name, value: name });
        });

        return optionBuilder;
      });

    return commandBuilder;
  })(),
  async execute(interaction) {
    const commandName = interaction.options.getString('command');
    const guildId = interaction.guild.id;
    const adminGuilds = process.env.ADMIN_GUILD_IDS.split(',');
    const isAdminGuild = adminGuilds.includes(guildId);

    const commands = [];

    // Dynamically load commands from the `commands` directory
    const foldersPath = path.join(__dirname, '../');
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
      if (folder === 'admin' && !isAdminGuild) continue; // Exclude admin commands if not an admin guild

      const commandsPath = path.join(foldersPath, folder);
      const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith('.js'));

      for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command) {
          commands.push(command);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setAuthor({
        name: interaction.client.user.username,
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setThumbnail(interaction.client.user.displayAvatarURL());

    if (commandName) {
      // Detailed help for a specific command
      const command = commands.find(
        (cmd) => cmd.data.name === commandName.toLowerCase()
      );
      if (!command) {
        return interaction.reply({
          content: `No command found with name \`${commandName}\`.`,
          ephemeral: true,
        });
      }

      embed
        .setTitle(`Help: /${command.data.name}`)
        .setDescription(command.data.description || 'No description provided.')
        .setColor('Blue')
        .addFields(
          {
            name: 'Cooldown',
            value: `${command.cooldown || 'None'} second(s)`,
            inline: true,
          },
          {
            name: 'Category',
            value: command.category || 'Uncategorized',
            inline: true,
          }
        );

      return interaction.reply({ embeds: [embed] });
    } else {
      // General help: list all commands
      embed
        .setTitle('Available Commands')
        .setDescription('Here is a list of all the commands available:');

      // Group commands by category
      const categories = {};
      for (const command of commands) {
        const category = command.category || 'Uncategorized';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(command.data.name);
      }

      for (const [category, cmds] of Object.entries(categories)) {
        embed.addFields({
          name: category,
          value: cmds.map((cmd) => `\`/${cmd}\``).join(', '),
        });
      }

      return interaction.reply({ embeds: [embed] });
    }
  },
};
