const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

// Access environment variables
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CREDENTIALS_PATH = path.join(__dirname, process.env.CREDENTIALS_PATH);
const APPLICATION_ID = process.env.APPLICATION_ID;

// Google Sheets setup for appending data
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
);
const sheets = google.sheets({ version: 'v4', auth });

// Initialize Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

// Register bot command: 'botw'
const commands = [
    {
        name: 'botw',
        description: 'Send drop for approval',
        options: [
            {
                name: 'team',
                type: 3, // STRING
                description: 'Team',
                required: true
            },
            {
                name: 'boss',
                type: 3, // STRING
                description: 'Boss',
                required: true
            },
            {
                name: 'drop',
                type: 3, // STRING
                description: 'Drop',
                required: true
            }
        ]
    }
];

// Register the commands globally
(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(APPLICATION_ID),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Google Sheets setup for reading rankings
const readAuth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function readSheet() {
    const sheets = google.sheets({ version: 'v4', auth: readAuth });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!G1:K2', // Adjust the range as needed
    });
    return response.data.values;
}

// Listen for interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'botw') {
        const message1 = interaction.options.getString('team');
        const message2 = interaction.options.getString('boss');
        const message3 = interaction.options.getString('drop');

        const now = new Date();
        const formattedDate = now.toLocaleString('en-GB', {
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZone: 'UTC',
        });

        const data = [
            [interaction.user.username, message1, message2, message3, formattedDate],
        ];

        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A1:E1',
                valueInputOption: 'USER_ENTERED',
                resource: { values: data },
            });

            await interaction.reply('Drop sent for approval!');
        } catch (error) {
            console.error('Error adding data to sheet:', error);
            await interaction.reply('Error 6969 Contact Jeffrie - 3rd Age.');
        }
    }
});

// Handle "!botw" message command for rankings with complicated padding
client.on('messageCreate', async (message) => {
    if (message.content === '!botw') {
        try {
            const rows = await readSheet();
            if (rows.length) {
                const header = rows[0];
                const data = rows[1];

                const maxLength = Math.max(...header.map(item => item.length), ...data.map(item => item.length));

                const centeredHeader = header.map(item => {
                    const padding = ' '.repeat((maxLength - item.length) / 2);
                    return `${padding}${item}${padding}`.slice(0, maxLength);
                }).join(' | ');

                const centeredData = data.map(item => {
                    const padding = ' '.repeat((maxLength - item.length) / 2);
                    return `${padding}${item}${padding}`.slice(0, maxLength);
                }).join('    |    ');

                message.channel.send(`Malediction BOTW Rankings:\n${centeredHeader}\n${centeredData}`);
            } else {
                message.channel.send('No data found.');
            }
        } catch (error) {
            console.error('Error reading from Google Sheets:', error);
            message.channel.send('Error 9696 Contact Jeffrie - 3rd Age');
        }
    }
});

// Login to Discord
client.login(DISCORD_TOKEN);
