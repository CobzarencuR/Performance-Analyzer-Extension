document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];

        if (!tab || tab.url.startsWith('chrome-error://')) {
            document.getElementById('current-domain').textContent = 'Error: Tab is showing an error page or cannot be accessed.';
            return;
        }

        const url = new URL(tab.url);
        const domain = extractDomain(url.hostname);

        // Display the current website domain
        const currentDomainElement = document.getElementById('current-domain');
        currentDomainElement.textContent = `${domain}`;

        const descenders = /[qypgj]/;
        if (descenders.test(domain)) {
            currentDomainElement.style.textUnderlineOffset = '0.225em';
        }

        if (domain === 'chrome' || domain === 'chrome-extension') {
            document.getElementById('metrics').innerHTML = 'Performance data is not available for this URL.';
            return;
        }

        chrome.scripting.executeScript(
            {
                target: { tabId: tabs[0].id },
                func: analyzePerformance
            },
            (results) => {
                try {
                    if (chrome.runtime.lastError) {
                        if (chrome.runtime.lastError.message === 'Frame with ID 0 is showing error page') {
                            // console.warn('Error: Tab is showing an error page.');
                            document.getElementById('metrics').innerHTML = 'Error: Tab is showing an error page.';
                            return;
                        }
                        throw new Error(chrome.runtime.lastError.message);
                    }
                    console.log('Script execution results:', results);
                    if (results && results[0] && results[0].result) {
                        const metrics = results[0].result;
                        document.getElementById('metrics').innerHTML = metrics;
                    } else {
                        document.getElementById('metrics').innerHTML = 'No performance data available.';
                    }
                } catch (error) {
                    // console.error('Error processing results:', error);
                    document.getElementById('metrics').innerHTML = error.message;
                }
            }
        );
    });

    //Extract the domain from the URL
    function extractDomain(hostname) {
        const regex = /^(?:https?:\/\/)?(?:www\.)?(.*?)\.(?:com|ro|net|org|eu|gov|app|edu|io|co|uk|li|to|ai|info|.mil|.int|.biz|.tv|.me|.mobi|.pro|.name|.travel|.coop|.jobs|.design|.eco|.health|.law|.music|.photography|.shop|.sport|.tech|.store|.studio|.science|.ngo|.ong|.fund|.guru|.wiki|.yoga|.academy|.blog|.book|.club|.dance|.earth)/;
        const match = regex.exec(hostname);
        const domain = match ? match[1] : hostname;
        return domain;
    }

    function analyzePerformance() {
        const performanceData = performance.timing;
        const resourceEntries = performance.getEntriesByType('resource');

        let totalData = 0;
        resourceEntries.forEach(entry => {
            if (entry.transferSize) {
                totalData += entry.transferSize;
            }
        });

        // Calculate the proportion for each metric
        const pageLoadTimeRatio = Math.min((performanceData.loadEventEnd - performanceData.navigationStart) / 10000, 1);
        const domContentLoadedRatio = Math.min((performanceData.domContentLoadedEventEnd - performanceData.navigationStart) / 10000, 1);
        const responseTimeRatio = Math.min((performanceData.responseEnd - performanceData.requestStart) / 10000, 1);

        const metrics = `
        <p>Page Load Time:<span class="metric-value">${performanceData.loadEventEnd - performanceData.navigationStart}ms</span></p>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${pageLoadTimeRatio * 100}%;"></div>
        </div>
        <p>DOM Content Loaded:<span class="metric-value">${performanceData.domContentLoadedEventEnd - performanceData.navigationStart}ms</span></p>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${domContentLoadedRatio * 100}%;"></div>
        </div>
        <p>Response Time:<span class="metric-value">${performanceData.responseEnd - performanceData.requestStart}ms</span></p>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${responseTimeRatio * 100}%;"></div>
        </div>
        <p>Number of Requests:<span class="metric-value">${resourceEntries.length}</span></p>
        <p>Total Data Consumed:<span class="metric-value">${(totalData / 1024).toFixed(2)} KB</span></p>
    `;
        return metrics;
    }

    // CPU Usage
    // Fetch CPU information
    function getCpuInfo() {
        return new Promise((resolve, reject) => {
            chrome.system.cpu.getInfo(cpuInfo => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(cpuInfo);
                }
            });
        });
    }

    getCpuInfo()
        .then(cpuInfo => {
            if (cpuInfo && cpuInfo.processors && cpuInfo.processors.length > 0) {
                let totalUsage = 0;
                let validProcessorCount = 0;
                cpuInfo.processors.forEach(function (processor) {
                    const { user, kernel, idle, total } = processor.usage;
                    const busy = user + kernel;
                    const usagePercentage = ((busy / total) * 100).toFixed(2);

                    if (!isNaN(usagePercentage)) {
                        totalUsage += parseFloat(usagePercentage);
                        validProcessorCount++;
                    } else {
                        console.error('Invalid CPU usage value:', processor.usage);
                    }
                });

                if (validProcessorCount > 0) {
                    const avgUsage = (totalUsage / validProcessorCount).toFixed(2);
                    document.getElementById('cpu-usage').innerHTML = `CPU Usage: <span class="metric-value">${avgUsage}%</span>`;
                } else {
                    console.error('No valid CPU usage values found.');
                    document.getElementById('cpu-usage').innerHTML = 'CPU usage not available';
                }
            } else {
                console.error('No CPU information available.');
                document.getElementById('cpu-usage').innerHTML = 'No CPU information available';
            }
        })
        .catch(error => {
            console.error('Error fetching CPU info:', error);
            document.getElementById('cpu-usage').innerHTML = 'Error fetching CPU information';
        });

    // Memory Usage
    chrome.system.memory.getInfo().then(function (memoryInfo) {
        if (memoryInfo) {
            const usedMemory = (memoryInfo.capacity - memoryInfo.availableCapacity) / (1024 * 1024);
            const totalMemory = memoryInfo.capacity / (1024 * 1024);
            const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(2);
            document.getElementById('memory-usage').innerHTML = `Memory Usage: <span class="metric-value">${memoryUsage}%</span>`;
        } else {
            document.getElementById('memory-usage').innerHTML = 'Memory information not available';
        }
    }).catch(function (error) {
        console.error('Error fetching memory info:', error);
        document.getElementById('memory-usage').innerHTML = 'Error fetching memory info';
    });

    // Battery Info
    if ('getBattery' in navigator) {
        navigator.getBattery().then(function (battery) {
            const batteryLevel = (battery.level * 100).toFixed(2);
            const chargingStatus = battery.charging ? 'Charging' : 'Not Charging';
            const timeRemaining = battery.dischargingTime !== Infinity ? (battery.dischargingTime / 60).toFixed(2) : 'Unknown';
            document.getElementById('battery-info').innerHTML = `
                    <p>Battery Level: <span class="metric-value">${batteryLevel}%</span></p>
                    <p>Charging Status: <span class="metric-value">${chargingStatus}</span></p>
                    <p>Time Remaining: <span class="metric-value">${timeRemaining} mins</span></p>
                `;
        }).catch(function (error) {
            console.error('Error fetching battery info:', error);
            document.getElementById('battery-info').innerHTML = 'Error fetching battery info';
        });
    } else {
        document.getElementById('battery-info').innerHTML = 'Battery information not available';
    }
});
