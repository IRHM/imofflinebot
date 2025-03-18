const {
	Client,
	Events,
	GatewayIntentBits,
	Message,
	ButtonBuilder,
	ActionRowBuilder,
	ButtonStyle,
	BaseInteraction,
	Presence,
} = require("discord.js");
const { token, userId, ntfy } = require("./data/config.json");
const { default: axios } = require("axios");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildPresences,
	],
});

// My guild member will be stored here for
// reuse. So we don't have to fetch it everytime
// I want to get my presence.
// Not sure if this is a supported use case, but
// every time I access .presence it is always
// an up to date value, so it must get a live
// value whenever called.
// Just explaining incase this becomes a way for
// related bugs later. We will only use this for
// presence checks.. other server specific stuff
// likely won't work, since this is a stored value
// from the one server it will currently be in.. not
// currently expecting it to be in more than this one.
let myUser;

client.once(Events.ClientReady, async (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

const notifyMe = async (title, body) => {
	return await axios({
		method: "POST",
		url: ntfy.url,
		headers: {
			Authorization: `Bearer ${ntfy.token}`,
			Title: title,
		},
		data: body,
	});
};

const procMsg = async (/** @type {Message} */ msg) => {
	try {
		// 0. Ignore our own messages
		if (msg.author.bot) {
			// Might aswell ignore all bots.
			return;
		}
		// 1. Check if i was mentioned.
		console.debug("procMsg:", msg.mentions);
		let iWasMentioned = false;
		if (msg.mentions.everyone) {
			iWasMentioned = true;
		} else if (msg.mentions.users.has(userId)) {
			iWasMentioned = true;
		}
		console.debug("procMsg: iWasMentioned:", iWasMentioned);
		if (!iWasMentioned) {
			return;
		}
		// 1.5 Am I available?
		if (!myUser) {
			// Only fetch our user once and store for reuse.
			// The later .presence check seems to always get
			// the updated presence of my user, so seems to
			// work as intended.
			myUser = await msg.guild.members.fetch(userId);
		}
		if (!myUser) {
			console.error("procMsg: Failed to get my user!");
			notifyMe(
				"Processing Failed!",
				"Sorry master, I failed to find your user in the guid!"
			).catch((err) => {
				console.error(
					"procMsg: Failed to alert master of error (couldn't find user)!",
					err
				);
			});
			return;
		}
		if (myUser.presence.status === "online") {
			console.debug("procMsg: We are online. Ignoring.");
			return;
		}
		// 2. I was so respond
		const pingMeBtn = new ButtonBuilder()
			.setCustomId("pingMe")
			.setLabel("Ping Them Directly")
			.setStyle(ButtonStyle.Primary);
		const row = new ActionRowBuilder().addComponents(pingMeBtn);
		msg.reply({
			content: `<@${userId}> is unavailable. May I take a message (i can't but is that funny lol)?`,
			components: [row],
		});
	} catch (err) {
		console.error("procMsg: Failed!", err);
		notifyMe("Processing Failed!", "We couldn't process a message!").catch(
			(err) => {
				console.error("procMsg: Failed to alert master of error!", err);
			}
		);
	}
};

const procInteraction = async (/** @type {BaseInteraction} */ interaction) => {
	try {
		if (!interaction.isButton() || interaction.customId !== "pingMe") {
			// We only understand one command, if not that, ignore.
			return;
		}
		console.log("direct ping requested");
		await notifyMe(
			"Direct Ping on Discord",
			"Someone wants your attention on Discord ;()"
		);
		// notifyMe will throw if fails, so we can safely assume success here.
		interaction.update({
			content: `<@${userId}> is unavailable. A direct ping was sent to get their attention.`,
			components: [],
		});
	} catch (err) {
		console.error("procInteraction: Failed!", err);
		interaction.update({
			content: `<@${userId}> is unavailable. The requested direct ping failed!\n\nAn error will be sent to my master, incase that fails too, you can ping them directly on another platform.`,
			components: [],
		});
		notifyMe(
			"Processing Interaction Failed!",
			"We couldn't process an interaction!"
		).catch((err) => {
			console.error(
				"procInteraction: Failed to alert master of error!",
				err
			);
		});
	}
};

client.on("messageCreate", procMsg);
client.on("interactionCreate", procInteraction);

client.login(token);
