// src/utils/statusRotator.js
import { ActivityType } from 'discord.js';

const statusList = [
  { name: '{serverCount} servers', type: ActivityType.Watching },
  { name: 'with code', type: ActivityType.Playing },
  { name: 'your commands', type: ActivityType.Listening },
  { name: 'being rewritten', type: ActivityType.Watching },
  { name: '/help for commands', type: ActivityType.Playing },
  { name: 'NEXI development', type: ActivityType.Competing },
  { name: 'Discord.js v14', type: ActivityType.Playing },
  { name: 'your messages', type: ActivityType.Listening },
  { name: 'the void', type: ActivityType.Watching },
  { name: 'for bugs', type: ActivityType.Watching },
];

export function startStatusRotation(client) {
  if (!client || !client.user) return;

  let currentIndex = 0;

  const updateStatus = () => {
    const status_list = statusList[currentIndex];

    // Replace placeholders
    let name = status_list.name;
    if (name.includes('{serverCount}')) {
      name = name.replace('{serverCount}', client.guilds.cache.size.toString());
    }

    client.user.setPresence({
      status: 'dnd',
      activities: [
        {
          name,
          type: status_list.type,
        },
      ],
    });

    currentIndex = (currentIndex + 1) % statusList.length;
  };

  updateStatus();

  // Rotate every 5 minutes (300000 ms)
  setInterval(updateStatus, 5 * 60 * 1000);
}