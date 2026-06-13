// helpers.js
// Self-contained helpers for creating player bodies, loading maps, and rendering.
// All functions accept `world` and/or `game` where needed; no reliance on window globals.

// TILE SIZE IN PIXELS
const TILE_SIZE = 40;

// Box2D aliases used throughout
const b2Vec2 = Box2D.Common.Math.b2Vec2;
const b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
const b2BodyDef = Box2D.Dynamics.b2BodyDef;
const b2Body = Box2D.Dynamics.b2Body;
const b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
const b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;

/**
 * Creates the physical Box2D body for a player.
 * Signature: createPlayerBody(e, world, game)
 * - e: player object with rx, ry, id
 * - world: Box2D world instance
 * - game: game state object (used to store body reference)
 */

/**
 * Initializes the player data structure and creates its body.
 * Signature: addPlayer(id, startX, startY, world, game)
 * - startX/startY are pixel coordinates (top-left spawn)
 */
// In helpers.js
function addPlayer(id, rx, ry, world, game) {
  if (!world || !game) throw new Error("addPlayer requires (id, rx, ry, world, game)");

  const player = {
    id: id,
    left: false, right: false, up: false, down: false,
    ms: 2.5,
    ac: 0.025,

    // rx/ry are the true center in meters
    rx: rx,
    ry: ry,
    lx: 0,
    ly: 0,
    a: 0,

    // Pixel position for rendering is purely meters * 100
    x: rx * 100,
    y: ry * 100,

    sync: null,
    directSet: false
  };

  game.players[id] = player;
  createPlayerBody(player, world, game);
}

/* -------------------------
   Tile registry and drawing
   ------------------------- */

// Tile definitions keyed by tile id used in the map packet
const TILE_TYPES = {
  1: { type: "square" },
  // Triangles are defined by normalized vectors centered on tile center
  1.2: { type: "tri", vectors: [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: 0.5 }] }, // 45BL
  1.3: { type: "tri", vectors: [{ x: 0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: -0.5 }] },  // 45TL
  1.1: { type: "tri", vectors: [{ x: -0.5, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: 0.5 }] },  // 45TR
  1.4: { type: "tri", vectors: [{ x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }, { x: 0.5, y: -0.5 }] }   // 45BR
};

// Simple square draw
function drawSquare(ctx, x, y) {
  ctx.fillStyle = "#444";
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
}

// Draw triangle using normalized vectors relative to tile center
function drawTriangle(ctx, x, y, vectors) {
  ctx.fillStyle = "#444";
  ctx.beginPath();

  const cx = x + TILE_SIZE / 2;
  const cy = y + TILE_SIZE / 2;

  vectors.forEach((v, i) => {
    const px = cx + v.x * TILE_SIZE;
    const py = cy + v.y * TILE_SIZE;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });

  ctx.closePath();
  ctx.fill();
}

/* -------------------------
   Map rendering and loading
   ------------------------- */

/**
 * Render the map tiles to the canvas context.
 * Expects map object with tiles[][] as in the map packet.
 * Signature: renderMap(ctx, map)
 */
function renderMap(ctx, map) {
  if (!map || !map.tiles) return;

  // Use x and y explicitly. map.tiles.length is the width.
  for (let x = 0; x < map.tiles.length; x++) {
    for (let y = 0; y < map.tiles[x].length; y++) {
      const tileId = map.tiles[x][y];
      if (!tileId) continue;

      const tile = TILE_TYPES[tileId];
      if (!tile) continue;

      // Proper pixel calculations
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (tile.type === "square") drawSquare(ctx, px, py);
      else if (tile.type === "tri") drawTriangle(ctx, px, py, tile.vectors);
    }
  }
}

/**
 * Build static wall bodies in the provided Box2D world from a map object.
 * Signature: loadMapIntoWorld(world, map)
 */
/* -------------------------
   Player rendering
   ------------------------- */

function renderPlayers(ctx, game) {
  if (!game || !game.players) return;

  for (let id in game.players) {
    const p = game.players[id];

    // Player circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
    ctx.fillStyle = "#FF0000";
    ctx.fill();

    // Direction line
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(
      p.x + Math.cos(p.a) * 19,
      p.y + Math.sin(p.a) * 19
    );
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/* -------------------------
   Unified render entrypoint
   ------------------------- */

function renderGame(ctx, game, map) {
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw map first, then players
  renderMap(ctx, map);
  renderPlayers(ctx, game);
}

/* -------------------------
   Wall body creation
   ------------------------- */

/**
 * Create a static Box2D body for a tile.
 * Signature: createWallBody(world, x, y, tile)
 * - x,y are pixel coordinates (top-left of tile)
 */
// 1. Update Player Physics
function createPlayerBody(e, world, game) {
  if (!world || !game) throw new Error("createPlayerBody requires (e, world, game)");
  if (e.rx == undefined || e.ry == undefined) return;

  const r = new b2FixtureDef();
  r.density = 1;
  r.shape = new b2CircleShape(0.19);

  if (game.isGravityEvent) {
    r.friction = 0.0;
    r.restitution = 0.3;
  } else {
    r.friction = 0.5;
    r.restitution = 0.2;
  }

  const i = new b2BodyDef();
  i.type = b2Body.b2_dynamicBody;
  i.linearDamping = 0.5;
  i.angularDamping = 0.5;

  const o = world.CreateBody(i);
  o.CreateFixture(r);
  o.SetPosition(new b2Vec2(e.rx, e.ry));
  o.player = e;
  game.bodies[e.id] = o;

  return o;
}
// 2. Pass `game` into map loader
function loadMapIntoWorld(world, map, game) {
  if (!world || !map || !map.tiles) return;

  for (let x = 0; x < map.tiles.length; x++) {
    for (let y = 0; y < map.tiles[x].length; y++) {
      const tileId = map.tiles[x][y];
      if (!tileId) continue;

      const tile = TILE_TYPES[tileId];
      if (!tile) continue;

      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      // Pass game down to the wall builder
      createWallBody(world, px, py, tile, game);
    }
  }
}

// 3. Update Wall Physics
function createWallBody(world, x, y, tile, game) {
  if (!world || !tile) return;

  const bodyDef = new b2BodyDef();
  bodyDef.type = b2Body.b2_staticBody;
  bodyDef.position.Set(
    (x + TILE_SIZE / 2) / 100,
    (y + TILE_SIZE / 2) / 100
  );

  const fixture = new b2FixtureDef();
  fixture.density = 1;

  // Apply Gravity Event physics if active
  if (game && game.isGravityEvent) {
    fixture.friction = 0.0;
    fixture.restitution = 0.3;
  } else {
    fixture.friction = 0; 
    fixture.restitution = 0;
  }

  if (tile.type === "square") {
    fixture.shape = new b2PolygonShape();
    fixture.shape.SetAsBox((TILE_SIZE / 2) / 100, (TILE_SIZE / 2) / 100);
  } else if (tile.type === "tri") {
    const verts = tile.vectors.map(v => {
      return new b2Vec2(v.x * (TILE_SIZE / 100), v.y * (TILE_SIZE / 100));
    });
    fixture.shape = new b2PolygonShape();
    fixture.shape.SetAsArray(verts, verts.length);
  }

  const body = world.CreateBody(bodyDef);
  body.CreateFixture(fixture);

  return body;
}
