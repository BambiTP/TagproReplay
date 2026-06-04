// ndjson.js

document.getElementById("playNDJSON").addEventListener("click", function() {
    var input = document.getElementById("ndjsonInput");
    
    if (!input.files || input.files.length === 0) {
        alert("Please select a file first.");
        return;
    }

    var file = input.files[0];
    // Debug log just in case your environment is returning something weird
    console.log("Captured file object:", file);

    var reader = new FileReader();

    reader.onload = function(event) {
        var text = event.target.result;
        var rawLines = text.split("\n");
        var packets = [];

        // 1. Clean and collect valid lines
        for (var i = 0; i < rawLines.length; i++) {
            var line = rawLines[i].trim();
            if (!line) continue;
            
            // Strip trailing comma if it exists
            if (line.endsWith(",")) {
                line = line.slice(0, -1);
            }

            try {
                var parsed = JSON.parse(line);
                if (Array.isArray(parsed) && parsed.length >= 2) {
                    packets.push(parsed);
                }
            } catch (e) {
                // Silently ignore broken lines
            }
        }

        console.log("Ready to play " + packets.length + " packets.");
        if (packets.length === 0) return;

        // 2. Playback loop
        var index = 0;

        function step() {
            if (index >= packets.length) {
                console.log("Playback finished.");
                return;
            }

            // Send to game engine
            if (window.Game && window.Game.handlePacket) {
                window.Game.handlePacket(packets[index]);
            }

            // Calculate delay for next packet
            if (index + 1 < packets.length) {
                // Grab index [0] to get the actual integer timestamp
                var currentTimestamp = packets[index][0];
                var nextTimestamp = packets[index + 1][0];
                var delay = nextTimestamp - currentTimestamp;
                
                if (delay < 0 || isNaN(delay)) delay = 0;

                index++;
                setTimeout(step, delay);
            } else {
                index++;
            }
        }

        step(); // Kick off playback
    };

    // If this throws an error, your framework/browser is modifying the HTML file input
    reader.readAsText(file); 
});