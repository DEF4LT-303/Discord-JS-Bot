require('dotenv').config(); // Load environment variables from .env
const { SlashCommandBuilder } = require('discord.js');
const { google } = require('googleapis');

// Load variables from environment
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH;

// Google Drive setup
const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

// Variables to store state
let monitoringChannels = {};
let lastKnownState = [];

module.exports = {
  cooldown: 5,
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('valheim')
    .setDescription('Set up file monitoring for Google Drive.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('file')
        .setDescription('Set the channel for file notifications.')
        .addStringOption((option) =>
          option
            .setName('channel_id')
            .setDescription('The channel ID where notifications will be sent.')
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    const channelId = interaction.options.getString('channel_id');

    // Check if the channel exists
    const channel = await interaction.client.channels
      .fetch(channelId)
      .catch(() => null);
    if (!channel) {
      return interaction.reply({
        content: 'Invalid channel ID. Please provide a valid ID.',
        ephemeral: true,
      });
    }

    // Start monitoring and store the channel ID
    monitoringChannels[interaction.guildId] = channelId;
    interaction.reply(
      `Monitoring enabled. Notifications will be sent to <#${channelId}>.`
    );

    // Start the folder monitoring process
    if (!monitoringChannels.polling) {
      monitoringChannels.polling = true;
      monitorFolder(interaction.client);
    }
  },
};

// Function to fetch files in the Google Drive folder
async function listFiles(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, modifiedTime)',
  });
  return res.data.files;
}

// Monitoring function
async function monitorFolder(client) {
  try {
    const files = await listFiles(FOLDER_ID);
    const newFiles = files.filter(
      (file) => !lastKnownState.find((oldFile) => oldFile.id === file.id)
    );
    const updatedFiles = files.filter((file) => {
      const oldFile = lastKnownState.find((oldFile) => oldFile.id === file.id);
      return oldFile && oldFile.modifiedTime !== file.modifiedTime;
    });

    for (const guildId in monitoringChannels) {
      const channelId = monitoringChannels[guildId];
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      if (newFiles.length) {
        channel.send(
          `New files uploaded:\n${newFiles.map((f) => `**${f.name}**`).join('\n')}`
        );
      }
      if (updatedFiles.length) {
        channel.send(
          `Files updated:\n${updatedFiles.map((f) => `**${f.name}**`).join('\n')}`
        );
      }
    }

    lastKnownState = files;
  } catch (error) {
    console.error('Error monitoring folder:', error);
  }

  // Poll again after a delay
  setTimeout(() => monitorFolder(client), 30000);
}
