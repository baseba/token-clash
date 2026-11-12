const SCENES = [
  { file: 'beach-2', me: ['#fadebf', '#e5943a'], foe: ['#f9d9b7', '#e48e33'] },
  { file: 'beach-night', me: ['#cce4fe', '#3f93f3'], foe: ['#c3def9', '#4092e3'] },
  { file: 'beach', me: ['#fffae8', '#f6d658'], foe: ['#fff8df', '#f6d34f'] },
  { file: 'cave-2', me: ['#919aaf', '#474f5f'], foe: ['#abaec2', '#5b5f79'] },
  { file: 'cave-night', me: ['#7b7993', '#35343f'], foe: ['#8689a6', '#3f4154'] },
  { file: 'cave', me: ['#9c836e', '#42382f'], foe: ['#a99684', '#56493e'] },
  { file: 'desert-night', me: ['#c0caee', '#4f69c6'], foe: ['#b8c1e5', '#4e63b6'] },
  { file: 'desert', me: ['#f1e0ae', '#d2aa34'], foe: ['#edd8a9', '#c99b34'] },
  { file: 'lake-night', me: ['#1866bc', '#091c32'], foe: ['#0b58b3', '#041222'] },
  { file: 'lake', me: ['#21b8f0', '#0d526b'], foe: ['#21b8f0', '#0d526b'] },
  { file: 'mountain-2', me: ['#89949f', '#41474f'], foe: ['#c9cdda', '#717b99'] },
  { file: 'mountain-night', me: ['#58607a', '#181a20'], foe: ['#6f7793', '#2e313b'] },
  { file: 'mountain', me: ['#b39777', '#5b4a36'], foe: ['#e2cdb4', '#b1844b'] },
  { file: 'ocean-night', me: ['#3f81a6', '#172a35'], foe: ['#4292bf', '#1d3a4b'] },
  { file: 'ocean', me: ['#43a7dd', '#19506d'], foe: ['#58bbf0', '#166c9a'] },
  { file: 'path-2', me: ['#d1c1bd', '#8e6e67'], foe: ['#d0beba', '#8c6b64'] },
  { file: 'path-night', me: ['#a1a2b8', '#54556c'], foe: ['#95a3b8', '#4a576b'] },
  { file: 'path', me: ['#d5c190', '#90783c'], foe: ['#d5c090', '#90763c'] },
  { file: 'snow-night', me: ['#dffbf8', '#5fe2d7'], foe: ['#e0fbf9', '#60e2d6'] },
  { file: 'snow', me: ['#ffffff', '#c6c6c6'], foe: ['#ffffff', '#c6c6c6'] },
  { file: 'tall-grass-night', me: ['#37966f', '#0f251c'], foe: ['#38b277', '#153b29'] },
  { file: 'tall-grass', me: ['#68b85c', '#2d5328'], foe: ['#89ca65', '#426d2a'] },
  { file: 'underwater', me: ['#6c92b2', '#304455'], foe: ['#698fb0', '#2e4152'] },
];

export function sceneFor(battleId) {
  const hash = [...String(battleId)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const scene = SCENES[hash % SCENES.length];
  return { image: `/backgrounds/${scene.file}.png`, me: scene.me, foe: scene.foe };
}
