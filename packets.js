// packets.js
// Packet reader that updates the provided worldRef and gameRef.
// Signature: readPacket(packet, worldRef, gameRef)

function readPacket(packet, worldRef, gameRef) {
  if (!Array.isArray(packet) || packet.length < 3) return;

  const type = packet[1];
  const data = packet[2];

  if (type === "p") {
    if (!Array.isArray(data)) return;

    data.forEach(pData => {
      // 1. Spawning
      if (!gameRef.players[pData.id]) {
        // Apply the 0.20m (half tile) offset immediately upon spawning
        const startX = pData.rx !== undefined ? pData.rx + 0.20 : 0;
        const startY = pData.ry !== undefined ? pData.ry + 0.20 : 0;

        addPlayer(pData.id, startX, startY, worldRef, gameRef);
        console.log(`Spawned player ${pData.id} at (${startX}, ${startY})m.`);

        // Flag if the player spawned with dummy (0,0) coordinates
        if (pData.rx === undefined && pData.ry === undefined) {
          gameRef.players[pData.id].needsFirstTeleport = true;
        }
      }

      const player = gameRef.players[pData.id];
      const body = gameRef.bodies[pData.id];
      let wakeUp = false;

      // 2. Keys
      const keys = ["up", "down", "left", "right"];
      if (gameRef.state === 1) {
        keys.forEach(key => {
          if (pData[key] !== undefined) {
            player[key] = pData[key] > 0;
            wakeUp = true;
          }
        });
      } else {
        keys.forEach(key => player[key] = false);
      }

      // 3. Position/Velocity/Angle
      let updatePos = false;
      let updateVel = false;
      let updateAngle = false;
      let directSet = false;

      const HALF_TILE_M = 0.20;

      // Continuous position updates (always offset to center)
      if (pData.rx !== undefined || pData.ry !== undefined) {
        player.rx = pData.rx !== undefined ? pData.rx + HALF_TILE_M : player.rx;
        player.ry = pData.ry !== undefined ? pData.ry + HALF_TILE_M : player.ry;
        updatePos = true;
      }

      if (pData.lx !== undefined || pData.ly !== undefined) {
        player.lx = pData.lx !== undefined ? pData.lx : player.lx;
        player.ly = pData.ly !== undefined ? pData.ly : player.ly;
        updateVel = true;
      }

      if (pData.a !== undefined) {
        player.a = pData.a;
        if (body) {
          body.SetAngularVelocity(pData.a);
          wakeUp = true;
        }
      }

      if (pData.ra !== undefined) {
        player.ra = pData.ra;
        updateAngle = true;
      }

      // Check for directSet flag
      if (pData.directSet !== undefined) {
        player.directSet = pData.directSet;
        if (pData.directSet === true) directSet = true;
      }

      // Velocity: always set directly, but strictly gate it behind the active game state
      if (updateVel && body) {
        if (gameRef.state !== 1) {
          // Lock the player in place during countdowns or ended states
          body.SetLinearVelocity(new b2Vec2(0, 0));
          player.lx = 0;
          player.ly = 0;
        } else {
          // Game is active, apply server velocities
          body.SetLinearVelocity(new b2Vec2(player.lx, player.ly));
          wakeUp = true;
        }
      }

      // Position: directSet = teleport, otherwise smooth
      if (updatePos && body) {
        if (directSet || player.needsFirstTeleport) {
          body.SetPosition(new b2Vec2(player.rx, player.ry));
          if (updateAngle) body.SetAngle(player.ra);
          player.sync = null;
          wakeUp = true;
          player.needsFirstTeleport = false; // Clear the flag so they smooth normally moving forward
        } else {
          const currentPos = body.GetPosition();
          const syncFrames = 6;

          player.sync = {
            to: { x: player.rx, y: player.ry, a: updateAngle ? player.ra : null },
            frame: syncFrames,
            step: {
              x: (player.rx - currentPos.x) / syncFrames,
              y: (player.ry - currentPos.y) / syncFrames,
              a: updateAngle ? (player.ra - body.GetAngle()) / syncFrames : 0
            }
          };
          wakeUp = true;
        }
      } else if (updateAngle && body && !directSet) {
        // Angle update without position update
        body.SetAngle(player.ra);
        wakeUp = true;
      }

      if (wakeUp && body) body.SetAwake(true);
    });

  } else if (type === "spawn") {
    console.log("Spawn animation event:", data);

  } else if (type === "clientInfo") {
    if (data.eventScripts && data.eventScripts.includes("/scripts/gravity.js")) {
      console.log("Gravity event activated!");
      gameRef.isGravityEvent = true;
    }

  } else if (type === "map") {
    console.log("Loaded map:", data);
    gameRef.currentMap = data;
    loadMapIntoWorld(worldRef, data);

    if (gameRef.canvas && data.tiles) {
      const width = data.tiles.length * 40;
      const height = data.tiles[0].length * 40;
      gameRef.canvas.width = width;
      gameRef.canvas.height = height;
      console.log(`Canvas resized to ${width}x${height}`);
    }

  } else if (type === "time") {
    gameRef.state = data.state;
    gameRef.time = data.time;

    if (gameRef.isGravityEvent) {
      if (gameRef.state === 1) {
        worldRef.SetGravity(new Box2D.Common.Math.b2Vec2(0, 9.8 / 2));
      } else {
        worldRef.SetGravity(new Box2D.Common.Math.b2Vec2(0, 0));
      }
    }

    if (data.state === 3) console.log(`Starting in ${Math.round(data.time / 1000)}s`);
    else if (data.state === 1) console.log("Game active");

  } else if (type === "end") {
    gameRef.state = 2;
    console.log(`Game ended! Winner: ${data.winner}`);

  } else if (type === "playerLeft") {
    const id = data;
    if (gameRef.bodies[id]) {
      worldRef.DestroyBody(gameRef.bodies[id]);
      delete gameRef.bodies[id];
    }
    delete gameRef.players[id];
    console.log(`Player ${id} left.`);
  }
}
