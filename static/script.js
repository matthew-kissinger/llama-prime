$(document).ready(function() {
    let selectedPrimer = null;
    let currentQuery = '';

    $('#send-button').click(sendMessage);
    $('#clear-button').click(clearAll);
    $('#user-input').keypress(function(e) {
        if(e.which == 13) sendMessage();
    });

    $('#num-primers').change(updateTemperatureInputs);
    updateTemperatureInputs();

    function updateTemperatureInputs() {
        let numPrimers = parseInt($('#num-primers').val());
        let temperatureInputs = $('#temperature-inputs');
        temperatureInputs.empty();
        for (let i = 0; i < numPrimers; i++) {
            temperatureInputs.append(`
                <div>
                    <label for="temp-${i}">Temp ${i+1}:</label>
                    <input type="number" id="temp-${i}" min="0" max="2" step="0.1" value="0.5">
                </div>
            `);
        }
    }

    function sendMessage() {
        var userMessage = $('#user-input').val();
        if (userMessage.trim() === '') return;

        currentQuery = userMessage; // Store the current query
        appendMessage('user', userMessage);
        $('#user-input').val('');

        $('#chat-container').append('<div id="primers-and-completions" style="width: 100%;"></div>');

        $('#primer-container').empty(); // Clear existing primers
        let primers = [];

        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/generate_primers');
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        let buffer = '';
        xhr.onprogress = function() {
            let newData = xhr.responseText.substr(xhr.seenBytes || 0);
            xhr.seenBytes = xhr.responseText.length;

            buffer += newData;
            let jsonLines = buffer.split('\n');
            buffer = jsonLines.pop(); // Keep the last incomplete line in the buffer

            jsonLines.forEach((jsonLine) => {
                if (jsonLine.trim()) {
                    try {
                        let data = JSON.parse(jsonLine);
                        if (data.index !== undefined && data.primer) {
                            updatePrimerButton(data.index, data.primer, data.done);
                        }
                    } catch (e) {
                        console.error("Error parsing JSON:", e, "Raw data:", jsonLine);
                    }
                }
            });
        };

        xhr.onerror = function() {
            appendMessage('ai', 'Signal intercepted. Rerouting through proxies...');
        };
        xhr.send(JSON.stringify({
            message: userMessage,
            num_primers: parseInt($('#num-primers').val()),
            temperatures: Array.from($('#temperature-inputs input')).map(input => parseFloat(input.value))
        }));

        function updatePrimerButton(index, primer, isDone) {
            let primerContainer = $('#primers-and-completions');
            let primerDiv = primerContainer.find(`.primer-div[data-index="${index}"]`);
            if (primerDiv.length === 0) {
                primerDiv = $(`<div class="primer-div" data-index="${index}" style="width: 100%; margin-bottom: 10px;"></div>`);
                primerContainer.append(primerDiv);
            }
            
            let formattedPrimer = formatPrimer(primer);
            primerDiv.html(`<button class="primer-button" style="width: 100%; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Primer ${index + 1}: <span class="primer-content">${formattedPrimer}</span></button>`);

            primerDiv.find('.primer-button').click(function() {
                $('.primer-button').removeClass('selected');
                $(this).addClass('selected');
                selectedPrimer = $(this).find('.primer-content').text();
                generateCompletion(selectedPrimer);
            });

            if (isDone) {
                primerDiv.removeClass('streaming').addClass('complete');
            } else {
                primerDiv.addClass('streaming').removeClass('complete');
            }
            $('#chat-container').scrollTop($('#chat-container')[0].scrollHeight);
        }
    }

    function formatPrimer(primer) {
        // Remove <<EOF>> and any text after it
        primer = primer.split('<<EOF>>')[0].trim();

        let parts = primer.split('Primer bot activated >>>PRIMER:');
        if (parts.length === 2) {
            return parts[0] + 'Primer bot activated >>>\nPRIMER: ' + parts[1];
        } else {
            let haikuMatch = primer.match(/^([\s\S]*?)\nPrimer bot/m);
            let primerMatch = primer.match(/PRIMER:([\s\S]*?)$/);
            if (haikuMatch && primerMatch) {
                return haikuMatch[1] + '\nPrimer bot activated >>>\nPRIMER:' + primerMatch[1];
            }
        }
        return primer; // If all else fails, return the modified primer
    }

    function generateCompletion(primer) {
        let completionDiv = $('<div class="branch"></div>');
        let messageDiv = $('<div class="message ai-message"></div>');
        messageDiv.append('<strong>LLAMA_PRIME:</strong> ' + formatPrimer(primer) + ' ');
        let completionSpan = $('<span class="completion-text"></span>');
        messageDiv.append(completionSpan);
        completionDiv.append(messageDiv);
        $('#primers-and-completions .primer-button.selected').after(completionDiv);

        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/generate_completion');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 3) {  // Processing
                let completionText = '';
                let jsonLines = xhr.responseText.split('\n');
                for (let jsonLine of jsonLines) {
                    if (jsonLine) {
                        try {
                            let data = JSON.parse(jsonLine);
                            if (data.text) {
                                completionText += data.text;
                                completionSpan.text(completionText);
                            }
                        } catch (e) {
                            console.error("Error parsing JSON:", e);
                        }
                    }
                }
                $('#chat-container').scrollTop($('#chat-container')[0].scrollHeight);
            }
        };
        xhr.onerror = function() {
            appendMessage('ai', 'Signal intercepted. Rerouting through proxies...');
        };
        xhr.send(JSON.stringify({primer: primer}));
    }

    function appendMessage(sender, message) {
        var messageClass = sender === 'user' ? 'user-message' : 'ai-message';
        var senderName = sender === 'user' ? '>' : 'LLAMA_PRIME:';
        $('#chat-container').append(
            '<div class="message ' + messageClass + '">' +
            '<strong>' + senderName + '</strong> ' + message +
            '</div>'
        );
        $('#chat-container').scrollTop($('#chat-container')[0].scrollHeight);
    }

    function clearAll() {
        $('#chat-container').empty();
        $('#primer-container').empty();
        $('#user-input').val('');
        selectedPrimer = null;
        currentQuery = '';
    }
});

// Glitch effect for logo
setInterval(() => {
    document.getElementById('llama-prime-logo').classList.add('glitch');
    setTimeout(() => {
        document.getElementById('llama-prime-logo').classList.remove('glitch');
    }, 200);
}, 3000);