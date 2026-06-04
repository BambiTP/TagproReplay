// game.js
// Encapsulates all global state and runtime behavior inside a single `game` object.
// Minimal global exposure: only `window.Game` for external controllers to interact with.

const game = {
  // Box2D world (meters)
  world: new Box2D.Dynamics.b2World(new Box2D.Common.Math.b2Vec2(0, 0), true),

  // runtime state
  players: {},
  bodies: {},
  state: 3,
  time: 0,
  currentMap: null,

  // canvas + rendering
  canvas: document.getElementById("gameCanvas"),
  ctx: null,

  // internal RAF id
  _rafId: null,

  // lifecycle
  started: false,
};

/* -------------------------
   Initialize canvas context
   ------------------------- */
if (!game.canvas) {
  throw new Error("No canvas element with id 'gameCanvas' found.");
}
game.ctx = game.canvas.getContext("2d");

/* -------------------------
   Helper wrappers
   ------------------------- */
game.createPlayerBody = function (e) {
  return createPlayerBody(e, this.world, this);
};

game.addPlayer = function (id, startX, startY) {
  return addPlayer(id, startX, startY, this.world, this);
};

game.loadMapIntoWorld = function (map) {
  return loadMapIntoWorld(this.world, map, this); 
};

game.renderGame = function () {
  return renderGame(this.ctx, this, this.currentMap);
};

/* -------------------------
   Packet handling
   ------------------------- */
game.handlePacket = function (packet) {
  // Directly pipes arrays into packets.js readPacket(packet, worldRef, gameRef)
  if (typeof readPacket === "function") {
    readPacket(packet, this.world, this);
  } else {
    console.error("packets.js readPacket function is not loaded or missing.");
  }
};

/* -------------------------
   Main loop
   ------------------------- */
game.loop = function () {
  // Update players from physics bodies
  for (let id in this.players) {
    const player = this.players[id];
    const body = this.bodies[id];
    if (!body) continue;

    const velocity = body.GetLinearVelocity();

    if (player.left && velocity.x > -player.ms) velocity.x -= player.ac;
    if (player.right && velocity.x < player.ms) velocity.x += player.ac;
    if (player.up && velocity.y > -player.ms) velocity.y -= player.ac;
    if (player.down && velocity.y < player.ms) velocity.y += player.ac;

    body.SetLinearVelocity(velocity);

    const pos = body.GetPosition();
    player.x = pos.x * 100;
    player.y = pos.y * 100;
    player.a = body.GetAngle();
  }

  // Step physics
  this.world.Step(1 / 60, 10, 10);
  this.world.ClearForces();

  // Render
  this.renderGame();

  // Schedule next frame
  this._rafId = requestAnimationFrame(this.loop.bind(this));
};

game.start = function () {
  if (this.started) return;
  this.started = true;
  // Kick off loop immediately
  this.loop();
  console.log("Game loop running. Waiting for packets...");
};

game.stop = function () {
  if (!this.started) return;
  this.started = false;
  if (this._rafId) {
    cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }
};

/* -------------------------
   Map setter helper
   ------------------------- */
game.setMap = function (map) {
  this.currentMap = map;
  this.loadMapIntoWorld(map);
};

/* -------------------------
   Utility: spawn player from server-style data
   ------------------------- */
game.spawnOrUpdateFromPacketData = function (pData) {
  if (!this.players[pData.id]) {
    const startX = (pData.rx || 0) * 100;
    const startY = (pData.ry || 0) * 100;
    this.addPlayer(pData.id, startX, startY);
    console.log(`Spawned player ${pData.id} via spawnOrUpdateFromPacketData.`);
  }
};

/* -------------------------
   Global Exposure
   ------------------------- */
window.Game = game;

/* -------------------------
   Auto-start loop
   ------------------------- */
game.start();