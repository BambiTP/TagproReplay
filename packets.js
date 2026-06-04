// packets.js
// Packet reader that updates the provided worldRef and gameRef.
// Signature: readPacket(packet, worldRef, gameRef)

function readPacket(packet, worldRef, gameRef) {
  // Basic validation
  if (!Array.isArray(packet) || packet.length < 3) return;

  const type = packet[1];
  const data = packet[2];

  if (type === "p") {
    // "p" packets: Player updates
    if (!Array.isArray(data)) return;

    data.forEach(pData => {
      // 1. Spawning
      if (!gameRef.players[pData.id]) {
        const startX = (pData.rx || 0) * 100;
        const startY = (pData.ry || 0) * 100;
        addPlayer(pData.id, startX, startY, worldRef, gameRef);
        console.log(`Spawned player ${pData.id}.`);
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

      // 3. Position/Velocity
      let updatePos = false;
      let updateVel = false;

      if (pData.rx !== undefined || pData.ry !== undefined) {
        player.rx = pData.rx !== undefined ? pData.rx + 0.19 : player.rx;
        player.ry = pData.ry !== undefined ? pData.ry + 0.19 : player.ry;
        updatePos = true;
      }

      if (pData.lx !== undefined || pData.ly !== undefined) {
        player.lx = pData.lx !== undefined ? pData.lx : player.lx;
        player.ly = pData.ly !== undefined ? pData.ly : player.ly;
        updateVel = true;
      }

      const b2Vec2 = Box2D.Common.Math.b2Vec2;
      if (updatePos && body) {
        body.SetPosition(new b2Vec2(player.rx, player.ry));
        wakeUp = true;
      }
      if (updateVel && body) {
        body.SetLinearVelocity(new b2Vec2(player.lx, player.ly));
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

  } else if (type === "time") {
    gameRef.state = data.state;
    gameRef.time = data.time;

    // Gravity logic based on state
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

  } else {
    // console.warn("Unknown packet type:", type);
  }
}