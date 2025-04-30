let physicalMemory = [];
let pageSize = 4;
let totalFrames = 8;
let pageFaults = 0;
let pageReferences = [];
let currentStep = 0;
let history = [];
let disk = [];
let pageTable = {};
let segmentTable = {};
let segments = [];
let mode = "paging"; // Default mode

const memoryDisplay = document.getElementById("memoryDisplay");
const status = document.getElementById("status");
const historyBody = document.getElementById("historyBody");
const tableTitle = document.getElementById("tableTitle");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const diskDisplay = document.getElementById("diskDisplay");
const refsLabel = document.getElementById("refsLabel");

function updateMode() {
    mode = document.getElementById("mode").value;
    document.getElementById("pagingInputs").style.display = mode === "paging" ? "block" : "none";
    document.getElementById("segmentationInputs").style.display = mode === "segmentation" ? "block" : "none";
    document.getElementById("pageRefs").placeholder = mode === "paging" ? "e.g., 1,2,3" : "e.g., 0:100,1:50";
    refsLabel.textContent = mode === "paging" ? "Page References (e.g., 1,2,3):" : "Segment References (e.g., 0:100,1:50):";
    tableTitle.textContent = mode === "paging" ? "Page Table" : "Segment Table";
    tableHead.innerHTML = mode === "paging" ? `
        <tr>
            <th>Page</th>
            <th>Frame</th>
            <th>In Memory</th>
        </tr>
    ` : `
        <tr>
            <th>Segment</th>
            <th>Base Address</th>
            <th>In Memory</th>
        </tr>
    `;

    physicalMemory = Array(totalFrames).fill(-1);
    pageFaults = 0;
    currentStep = 0;
    history = [];
    pageReferences = [];
    disk = [];
    pageTable = {};
    segmentTable = {};
    segments = [];
    historyBody.innerHTML = "";
    drawMemory();
    updateTable();
    updateDisk();
    status.textContent = "Status: Mode changed. Please initialize memory.";
}

function validateReferences(refString) {
    console.log(`Validating references: ${refString}, mode: ${mode}`);
    if (mode === "paging") {
        const refs = refString.split(",").map(x => parseInt(x.trim())).filter(x => !isNaN(x));
        const isValid = refString.split(",").every(x => {
            const num = parseInt(x.trim());
            return !isNaN(num) && !x.includes(":");
        });
        if (!isValid) {
            console.log("Invalid input for Paging mode");
            alert("Invalid input for Paging mode. Use page numbers (e.g., 1,2,3).");
            return null;
        }
        console.log(`Validated paging references: ${refs}`);
        return refs;
    } else {
        const refs = refString.split(",").map(x => {
            const [seg, offset] = x.split(":").map(y => parseInt(y.trim()));
            return { segment: seg, offset: offset };
        }).filter(x => !isNaN(x.segment) && !isNaN(x.offset));
        const isValid = refString.split(",").every(x => x.includes(":") && x.split(":").length === 2 && !isNaN(parseInt(x.split(":")[0])) && !isNaN(parseInt(x.split(":")[1])));
        if (!isValid) {
            console.log("Invalid input for Segmentation mode");
            alert("Invalid input for Segmentation mode. Use segment:offset pairs (e.g., 0:100,1:50).");
            return null;
        }
        console.log(`Validated segmentation references: ${JSON.stringify(refs)}`);
        return refs;
    }
}

function initializeMemory() {
    pageSize = parseInt(document.getElementById("pageSize").value);
    totalFrames = parseInt(document.getElementById("numFrames").value);
    if (isNaN(pageSize) || pageSize < 1 || isNaN(totalFrames) || totalFrames < 1) {
        alert("Please enter valid Page Size and Number of Frames.");
        return;
    }

    physicalMemory = Array(totalFrames).fill(-1);
    pageFaults = 0;
    currentStep = 0;
    history = [];
    pageReferences = [];
    disk = [];
    pageTable = {};
    segmentTable = {};
    segments = [];

    if (mode === "segmentation") {
        const segmentInput = document.getElementById("segments").value.trim();
        if (segmentInput) {
            segments = segmentInput.split(",").map(x => parseInt(x.trim())).filter(x => !isNaN(x));
            if (segments.length === 0 || segments.length > totalFrames) {
                segments = [5, 3, 2];
                alert("Invalid segment sizes. Using default: 5,3,2.");
            }
        } else {
            segments = [5, 3, 2];
            alert("No segment sizes provided. Using default: 5,3,2.");
        }
        segments.forEach((size, index) => {
            segmentTable[index] = { base: -1, inMemory: false };
        });
    }

    historyBody.innerHTML = "";
    drawMemory();
    updateTable();
    updateDisk();
    status.textContent = "Status: Memory initialized";
}

function drawMemory() {
    memoryDisplay.innerHTML = "";
    if (mode === "paging") {
        physicalMemory.forEach((page, index) => {
            const frame = document.createElement("div");
            frame.className = "frame";
            frame.style.width = "80px";
            frame.textContent = page === -1 ? "Empty" : page;
            frame.classList.add(page === -1 ? "empty" : "filled");
            memoryDisplay.appendChild(frame);
        });
    } else {
        let currentPos = 0;
        for (let index = 0; index < totalFrames; index++) {
            const segment = document.createElement("div");
            segment.className = "frame";
            if (index < segments.length) {
                const size = segments[index];
                segment.style.width = `${Math.min(size * 20, 200)}px`;
                segment.textContent = physicalMemory[index] !== -1 ? `Seg ${index}` : "Empty";
                segment.classList.add(physicalMemory[index] === -1 ? "empty" : "filled");
                if (physicalMemory[index] !== -1) {
                    segmentTable[index].base = currentPos;
                    segmentTable[index].inMemory = true;
                }
                currentPos += size;
            } else {
                segment.style.width = "80px";
                segment.textContent = "Empty";
                segment.classList.add("empty");
            }
            memoryDisplay.appendChild(segment);
        }
    }
}

function updateTable() {
    tableBody.innerHTML = "";
    if (mode === "paging") {
        Object.keys(pageTable).forEach(page => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${page}</td>
                <td>${pageTable[page].frame !== -1 ? pageTable[page].frame : "N/A"}</td>
                <td>${pageTable[page].inMemory ? "Yes" : "No"}</td>
            `;
            tableBody.appendChild(row);
        });
    } else {
        Object.keys(segmentTable).forEach(segment => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${segment}</td>
                <td>${segmentTable[segment].base !== -1 ? segmentTable[segment].base : "N/A"}</td>
                <td>${segmentTable[segment].inMemory ? "Yes" : "No"}</td>
            `;
            tableBody.appendChild(row);
        });
    }
}

function updateDisk() {
    diskDisplay.innerHTML = "";
    disk.forEach(item => {
        const diskPage = document.createElement("div");
        diskPage.className = "disk-page";
        diskPage.textContent = mode === "paging" ? item : `Seg ${item}`;
        diskDisplay.appendChild(diskPage);
    });
}

async function runSimulation() {
    const algorithm = document.getElementById("algorithm").value;
    console.log(`Starting simulation with ${algorithm.toUpperCase()}...`);
    const refString = document.getElementById("pageRefs").value;
    pageReferences = validateReferences(refString);
    if (!pageReferences) return;

    pageFaults = 0;
    let queue = []; // For FIFO
    let lruOrder = []; // For LRU
    history = [];
    console.log(`Initial physicalMemory: ${physicalMemory}`);

    for (let ref of pageReferences) {
        let action = "Hit";
        let segment = null;
        let offset = null;
        let refDisplay = ref;

        if (mode === "paging") {
            const page = ref;
            if (!physicalMemory.includes(page)) {
                pageFaults++;
                action = "Page Fault";
                if (!pageTable[page]) pageTable[page] = { frame: -1, inMemory: false };
                if (queue.length < totalFrames) {
                    const frameIdx = physicalMemory.indexOf(-1);
                    physicalMemory[frameIdx] = page;
                    pageTable[page].frame = frameIdx;
                    pageTable[page].inMemory = true;
                    queue.push(page);
                    lruOrder.push(page);
                } else if (algorithm === "fifo") {
                    const oldPage = queue.shift();
                    disk.push(oldPage);
                    const frameIdx = physicalMemory.indexOf(oldPage);
                    physicalMemory[frameIdx] = page;
                    pageTable[oldPage].frame = -1;
                    pageTable[oldPage].inMemory = false;
                    pageTable[page].frame = frameIdx;
                    pageTable[page].inMemory = true;
                    queue.push(page);
                    lruOrder.push(page);
                } else { // LRU
                    const lruPage = lruOrder.shift();
                    disk.push(lruPage);
                    const frameIdx = physicalMemory.indexOf(lruPage);
                    physicalMemory[frameIdx] = page;
                    pageTable[lruPage].frame = -1;
                    pageTable[lruPage].inMemory = false;
                    pageTable[page].frame = frameIdx;
                    pageTable[page].inMemory = true;
                    lruOrder.push(page);
                }
            } else if (algorithm === "lru") {
                lruOrder = lruOrder.filter(p => p !== page); // Remove from current position
                lruOrder.push(page); // Move to end (most recently used)
            }
            refDisplay = page;
        } else {
            ({ segment, offset } = ref);
            if (segment >= segments.length) {
                pageFaults++;
                action = "Segment Fault";
            } else if (offset > segments[segment] || physicalMemory[segment] === -1) {
                pageFaults++;
                action = "Segment Fault";
                if (offset <= segments[segment]) {
                    if (queue.length < segments.length) {
                        physicalMemory[segment] = segment;
                        segmentTable[segment].base = segments.slice(0, segment).reduce((sum, size) => sum + size, 0);
                        segmentTable[segment].inMemory = true;
                        queue.push(segment);
                        lruOrder.push(segment);
                    } else if (algorithm === "fifo") {
                        const oldSegment = queue.shift();
                        disk.push(oldSegment);
                        physicalMemory[oldSegment] = -1;
                        segmentTable[oldSegment].base = -1;
                        segmentTable[oldSegment].inMemory = false;
                        physicalMemory[segment] = segment;
                        segmentTable[segment].base = segments.slice(0, segment).reduce((sum, size) => sum + size, 0);
                        segmentTable[segment].inMemory = true;
                        queue.push(segment);
                        lruOrder.push(segment);
                    } else { // LRU
                        const lruSegment = lruOrder.shift();
                        disk.push(lruSegment);
                        physicalMemory[lruSegment] = -1;
                        segmentTable[lruSegment].base = -1;
                        segmentTable[lruSegment].inMemory = false;
                        physicalMemory[segment] = segment;
                        segmentTable[segment].base = segments.slice(0, segment).reduce((sum, size) => sum + size, 0);
                        segmentTable[segment].inMemory = true;
                        lruOrder.push(segment);
                    }
                }
            } else if (algorithm === "lru") {
                lruOrder = lruOrder.filter(s => s !== segment);
                lruOrder.push(segment);
            }
            refDisplay = `${segment}:${offset}`;
        }

        history.push({ ref: refDisplay, action, faults: pageFaults });
        drawMemory();
        updateTable();
        updateDisk();
        updateHistory();
        status.textContent = `Status: Faults: ${pageFaults}`;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    alert(`Simulation complete with ${algorithm.toUpperCase()}!\nTotal Faults: ${pageFaults}`);
}

function stepThrough() {
    const algorithm = document.getElementById("algorithm").value;
    const refString = document.getElementById("pageRefs").value;
    pageReferences = validateReferences(refString);
    if (!pageReferences) return;

    if (currentStep >= pageReferences.length) {
        alert(`Simulation complete!\nTotal Faults: ${pageFaults}`);
        return;
    }

    let queue = physicalMemory.filter(item => item !== -1);
    let lruOrder = physicalMemory.filter(item => item !== -1);
    let ref = pageReferences[currentStep];
    let action = "Hit";
    let segment = null;
    let offset = null;
    let refDisplay = ref;

    if (mode === "paging") {
        const page = ref;
        if (!physicalMemory.includes(page)) {
            pageFaults++;
            action = "Page Fault";
            if (!pageTable[page]) pageTable[page] = { frame: -1, inMemory: false };
            if (queue.length < totalFrames) {
                const frameIdx = physicalMemory.indexOf(-1);
                physicalMemory[frameIdx] = page;
                pageTable[page].frame = frameIdx;
                pageTable[page].inMemory = true;
                queue.push(page);
                lruOrder.push(page);
            } else if (algorithm === "fifo") {
                const oldPage = queue.shift();
                disk.push(oldPage);
                const frameIdx = physicalMemory.indexOf(oldPage);
                physicalMemory[frameIdx] = page;
                pageTable[oldPage].frame = -1;
                pageTable[oldPage].inMemory = false;
                pageTable[page].frame = frameIdx;
                pageTable[page].inMemory = true;
                queue.push(page);
                lruOrder.push(page);
            } else { // LRU
                const lruPage = lruOrder.shift();
                disk.push(lruPage);
                const frameIdx = physicalMemory.indexOf(lruPage);
                physicalMemory[frameIdx] = page;
                pageTable[lruPage].frame = -1;
                pageTable[lruPage].inMemory = false;
                pageTable[page].frame = frameIdx;
                pageTable[page].inMemory = true;
                lruOrder.push(page);
            }
        } else if (algorithm === "lru") {
            lruOrder = lruOrder.filter(p => p !== page);
            lruOrder.push(page);
        }
        refDisplay = page;
    } else {
        ({ segment, offset } = ref);
        if (segment >= segments.length) {
            pageFaults++;
            action = "Segment Fault";
        } else if (offset > segments[segment] || physicalMemory[segment] === -1) {
            pageFaults++;
            action = "Segment Fault";
            if (offset <= segments[segment]) {
                if (queue.length < segments.length) {
                    physicalMemory[segment] = segment;
                    segmentTable[segment].base = segments.slice(0, segment).reduce((sum, size) => sum + size, 0);
                    segmentTable[segment].inMemory = true;
                    queue.push(segment);
                    lruOrder.push(segment);
                } else if (algorithm === "fifo") {
                    const oldSegment = queue.shift();
                    disk.push(oldSegment);
                    physicalMemory[oldSegment] = -1;
                    segmentTable[oldSegment].base = -1;
                    segmentTable[oldSegment].inMemory = false;
                    physicalMemory[segment] = segment;
                    segmentTable[segment].base = segments.slice(0, segment).reduce((sum, size) => sum + size, 0);
                    segmentTable[segment].inMemory = true;
                    queue.push(segment);
                    lruOrder.push(segment);
                } else { // LRU
                    const lruSegment = lruOrder.shift();
                    disk.push(lruSegment);
                    physicalMemory[lruSegment] = -1;
                    segmentTable[lruSegment].base = -1;
                    segmentTable[lruSegment].inMemory = false;
                    physicalMemory[segment] = segment;
                    segmentTable[segment].base = segments.slice(0, segment).reduce((sum, size) => sum + size, 0);
                    segmentTable[segment].inMemory = true;
                    lruOrder.push(segment);
                }
            }
        } else if (algorithm === "lru") {
            lruOrder = lruOrder.filter(s => s !== segment);
            lruOrder.push(segment);
        }
        refDisplay = `${segment}:${offset}`;
    }

    history.push({ ref: refDisplay, action, faults: pageFaults });
    drawMemory();
    updateTable();
    updateDisk();
    updateHistory();
    status.textContent = `Status: Faults: ${pageFaults}`;
    currentStep++;
}

function updateHistory() {
    historyBody.innerHTML = "";
    history.forEach(entry => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${entry.ref}</td>
            <td>${entry.action}</td>
            <td>${entry.faults}</td>
        `;
        historyBody.appendChild(row);
    });
}

function clearMemory() {
    physicalMemory = Array(totalFrames).fill(-1);
    document.getElementById("pageRefs").value = "";
    pageFaults = 0;
    currentStep = 0;
    history = [];
    disk = [];
    pageTable = {};
    segmentTable = {};
    historyBody.innerHTML = "";
    drawMemory();
    updateTable();
    updateDisk();
    status.textContent = "Status: Memory cleared";
}

function toggleTheme() {
    document.body.classList.toggle("dark");
    const icon = document.getElementById("themeToggle").querySelector("i");
    icon.classList.toggle("fa-moon");
    icon.classList.toggle("fa-sun");
}

updateMode();
