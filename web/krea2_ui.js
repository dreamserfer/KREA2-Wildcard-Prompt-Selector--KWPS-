import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "KREA2.PromptBuilderUI",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "KREA2PromptBuilder") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                const customTextWidget = this.widgets.find(w => w.name === "custom_text");
                if (customTextWidget) customTextWidget.computeSize = (width) => [width, 54];

                // Completely remove the string widget from the visual node canvas while keeping its value accessible
                const hiddenWidget = this.widgets.find(w => w.name === "selected_wildcards");
                if (hiddenWidget) {
                    // Hide the widget completely from view via zero-size and CSS opacity/display trick
                    hiddenWidget.computeSize = () => [0, -4];
                    if (hiddenWidget.inputEl) {
                        hiddenWidget.inputEl.style.display = "none";
                    }
                }
                
                if (!document.getElementById("krea2-custom-styles")) {
                    const style = document.createElement("style");
                    style.id = "krea2-custom-styles";
                    style.innerHTML = `
                        .krea2-hover-target { position: relative; }
                        
                        .krea2-header-del {
                            visibility: hidden;
                            opacity: 0;
                            color: #ff4a4a !important;
                            cursor: pointer;
                            font-weight: bold;
                            font-size: 14px;
                            transition: opacity 0.1s, transform 0.1s;
                            margin-right: 4px;
                        }
                        .krea2-hover-target:hover .krea2-header-del {
                            visibility: visible;
                            opacity: 1;
                        }
                        .krea2-header-del:hover { color: #ff0000 !important; transform: scale(1.2); }

                        .krea2-actions-wrapper {
                            position: absolute;
                            right: -1px;
                            top: -1px;
                            bottom: -1px;
                            padding: 0 6px;
                            border-radius: 3px;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            opacity: 0;
                            visibility: hidden;
                            transition: opacity 0.1s;
                            z-index: 10;
                        }
                        .krea2-hover-target:hover .krea2-actions-wrapper {
                            visibility: visible;
                            opacity: 1;
                        }
                        
                        .krea2-action-btn {
                            cursor: pointer;
                            font-weight: bold;
                            line-height: 1;
                            transition: transform 0.1s;
                        }
                        .krea2-edit-btn { color: #f39c12 !important; font-size: 12px; }
                        .krea2-del-btn { color: #ff4a4a !important; font-size: 14px; }
                        
                        .krea2-edit-btn:hover { color: #f1c40f !important; transform: scale(1.2); }
                        .krea2-del-btn:hover { color: #ff0000 !important; transform: scale(1.2); }
                        
                        .krea2-input { background: #111; color: #fff; border: 1px solid #555; padding: 3px 5px; border-radius: 3px; font-size: 11px; }
                        .krea2-input::placeholder { color: #666; }
                        
                        .krea2-scroll::-webkit-scrollbar { width: 6px; }
                        .krea2-scroll::-webkit-scrollbar-track { background: #1a1a1a; border-radius: 4px; }
                        .krea2-scroll::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
                        .krea2-scroll::-webkit-scrollbar-thumb:hover { background: #777; }
                        
                        tr:has(input[value*="selected_wildcards"]), div:has(> label:contains("selected_wildcards")) {
                            display: none !important;
                        }
                    `;
                    document.head.appendChild(style);
                }

                // CRITICAL FIX: The Sandbox Wrapper
                // This forces the UI to stay exactly within the grey node boundaries.
                const wrapper = document.createElement("div");
                wrapper.style.cssText = "width: 100%; height: 100%; position: relative; overflow: hidden;";

                const ui = document.createElement("div");
                ui.className = "krea2-scroll";
                ui.style.cssText = `
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    padding: 8px;
                    background-color: #1e1e1e;
                    border: 1px solid #333;
                    border-radius: 6px;
                    color: #ddd;
                    font-family: sans-serif;
                    font-size: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    overflow-y: auto;
                    box-sizing: border-box;
                `;
                
                // Add the UI into the Sandbox Wrapper
                wrapper.appendChild(ui);

                const stopEvent = (e) => e.stopPropagation();
                ["pointerdown", "pointerup", "mousedown", "mouseup", "wheel", "keydown", "keyup", "contextmenu"].forEach(evt => {
                    ui.addEventListener(evt, stopEvent, { capture: true });
                });

                let wildcardsData = { categories: [] };
                let selectedTags = new Set();
                let expandedCategories = new Set(); 

                const updateOutput = () => {
                    if (hiddenWidget) {
                        let promptChunks = [];
                        selectedTags.forEach(tagName => {
                            for (let cat of wildcardsData.categories) {
                                if (!cat.wildcards) continue;
                                let wc = cat.wildcards.find(w => w.name === tagName);
                                if (wc) {
                                    promptChunks.push(wc.value || wc.name);
                                    break;
                                }
                            }
                        });
                        hiddenWidget.value = promptChunks.join(", ");
                    }
                };

                const saveToServer = async () => {
                    try {
                        await fetch("/krea2/wildcards_save", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(wildcardsData)
                        });
                    } catch (err) {
                        console.error("Failed to save:", err);
                    }
                };

                const render = () => {
                    ui.innerHTML = ""; 

                    const toolbar = document.createElement("div");
                    toolbar.style.cssText = `
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #333;
                        flex-shrink: 0; 
                    `;

                    const titleArea = document.createElement("div");
                    titleArea.style.display = "flex";
                    titleArea.style.gap = "8px";
                    titleArea.style.alignItems = "center";

                    const title = document.createElement("strong");
                    title.innerText = "WILDCARDS";
                    title.style.color = "#888";

                    const addCatBtn = document.createElement("button");
                    addCatBtn.innerText = "+ Cat";
                    addCatBtn.style.cssText = "background: #2ecc71; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 2px 6px; font-size: 10px;";
                    
                    const catInputWrapper = document.createElement("div");
                    catInputWrapper.style.display = "none";
                    catInputWrapper.style.gap = "4px";

                    const catInput = document.createElement("input");
                    catInput.className = "krea2-input";
                    catInput.style.width = "100px";
                    catInput.placeholder = "Category Name...";

                    const saveCatBtn = document.createElement("button");
                    saveCatBtn.innerText = "✓";
                    saveCatBtn.style.cssText = "background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 2px 6px;";

                    const cancelCatBtn = document.createElement("button");
                    cancelCatBtn.innerText = "X";
                    cancelCatBtn.style.cssText = "background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 2px 6px;";

                    addCatBtn.onclick = () => {
                        addCatBtn.style.display = "none";
                        catInputWrapper.style.display = "flex";
                        catInput.focus();
                    };

                    cancelCatBtn.onclick = () => {
                        addCatBtn.style.display = "block";
                        catInputWrapper.style.display = "none";
                        catInput.value = "";
                    };

                    saveCatBtn.onclick = async () => {
                        const newCatName = catInput.value.trim();
                        if (newCatName) {
                            const colors = ["#3498db", "#9b59b6", "#e67e22", "#e74c3c", "#1abc9c", "#f1c40f"];
                            const color = colors[wildcardsData.categories.length % colors.length];
                            wildcardsData.categories.push({
                                name: newCatName,
                                color: color,
                                image: "",
                                wildcards: []
                            });
                            
                            expandedCategories.add(newCatName);
                            
                            await saveToServer();
                            render();
                        }
                    };

                    catInput.onkeydown = async (e) => {
                        if (e.key === "Enter") saveCatBtn.onclick();
                        if (e.key === "Escape") cancelCatBtn.onclick();
                    };

                    catInputWrapper.appendChild(catInput);
                    catInputWrapper.appendChild(saveCatBtn);
                    catInputWrapper.appendChild(cancelCatBtn);

                    titleArea.appendChild(title);
                    titleArea.appendChild(addCatBtn);
                    titleArea.appendChild(catInputWrapper);

                    const clearBtn = document.createElement("button");
                    clearBtn.innerText = "Clear All";
                    clearBtn.style.cssText = "background: transparent; color: #e74c3c; border: none; cursor: pointer; font-size: 11px;";
                    clearBtn.onclick = () => {
                        selectedTags.clear();
                        updateOutput();
                        render();
                    };

                    toolbar.appendChild(titleArea);
                    toolbar.appendChild(clearBtn);
                    ui.appendChild(toolbar);

                    if (!wildcardsData.categories) wildcardsData.categories = [];

                    wildcardsData.categories.forEach((cat, catIndex) => {
                        const catContainer = document.createElement("div");
                        catContainer.style.cssText = `
                            flex-shrink: 0; 
                            background: #252525; 
                            border: 1px solid ${cat.color}40; 
                            border-radius: 4px; 
                            overflow: hidden;
                        `;

                        const header = document.createElement("div");
                        const isExpanded = expandedCategories.has(cat.name);
                        
                        header.className = "krea2-hover-target";
                        header.style.cssText = `padding: 6px 8px; cursor: pointer; background: ${cat.color}20; border-left: 3px solid ${cat.color}; display: flex; justify-content: space-between; align-items: center; user-select: none;`;
                        
                        const selectedInCat = cat.wildcards ? cat.wildcards.filter(w => selectedTags.has(w.name)).length : 0;
                        
                        const headerLeft = document.createElement("div");
                        headerLeft.style.cssText = "display:flex; align-items:center; gap:6px;";
                        headerLeft.innerHTML = `
                            <span style="font-size: 10px; color:#aaa;">${isExpanded ? '▼' : '▶'}</span>
                            <strong style="color: #fff;">${cat.name}</strong>
                        `;

                        const headerRight = document.createElement("div");
                        headerRight.style.cssText = "display:flex; align-items:center; gap:4px;";

                        const delCatBtn = document.createElement("span");
                        delCatBtn.className = "krea2-header-del";
                        delCatBtn.innerHTML = "&times;";
                        delCatBtn.title = "Delete Category";

                        let catDelConfirm = false;
                        delCatBtn.onclick = async (e) => {
                            e.stopPropagation(); 
                            if (!catDelConfirm) {
                                catDelConfirm = true;
                                delCatBtn.innerText = "Sure?";
                                delCatBtn.style.fontSize = "10px";
                                setTimeout(() => {
                                    catDelConfirm = false;
                                    delCatBtn.innerHTML = "&times;";
                                    delCatBtn.style.fontSize = "14px";
                                }, 2000);
                            } else {
                                wildcardsData.categories.splice(catIndex, 1);
                                if (cat.wildcards) cat.wildcards.forEach(w => selectedTags.delete(w.name));
                                expandedCategories.delete(cat.name);
                                updateOutput();
                                await saveToServer();
                                render();
                            }
                        };

                        const badge = document.createElement("div");
                        badge.style.cssText = `background: ${selectedInCat > 0 ? cat.color : '#444'}; color: ${selectedInCat > 0 ? '#fff' : '#aaa'}; font-size: 10px; padding: 2px 6px; border-radius: 10px;`;
                        badge.innerText = selectedInCat;

                        headerRight.appendChild(delCatBtn);
                        headerRight.appendChild(badge);
                        header.appendChild(headerLeft);
                        header.appendChild(headerRight);

                        const tagsArea = document.createElement("div");
                        tagsArea.style.cssText = `padding: 8px; display: ${isExpanded ? 'flex' : 'none'}; flex-wrap: wrap; gap: 4px; background: #1a1a1a;`;

                        header.onclick = () => {
                            if (expandedCategories.has(cat.name)) expandedCategories.delete(cat.name);
                            else expandedCategories.add(cat.name);
                            render();
                        };
                        catContainer.appendChild(header);

                        if (cat.wildcards) {
                            cat.wildcards.forEach((wc, wcIndex) => {
                                const wcNodeWrapper = document.createElement("div");
                                wcNodeWrapper.style.display = "inline-flex";

                                const btn = document.createElement("button");
                                const isSelected = selectedTags.has(wc.name);
                                
                                btn.className = "krea2-hover-target";
                                btn.title = wc.value || wc.name; 
                                
                                btn.style.cssText = `
                                    display: inline-flex;
                                    align-items: center;
                                    position: relative;
                                    background: ${isSelected ? (wc.color || cat.color || '#3498db') : '#2a2a2a'};
                                    color: ${isSelected ? '#fff' : '#bbb'};
                                    border: 1px solid ${isSelected ? 'transparent' : '#444'};
                                    border-radius: 3px;
                                    padding: 4px 8px;
                                    cursor: pointer;
                                    font-size: 11px;
                                    font-weight: ${isSelected ? 'bold' : 'normal'};
                                `;

                                const textSpan = document.createElement("span");
                                textSpan.innerText = wc.name;

                                const actionsWrapper = document.createElement("div");
                                actionsWrapper.className = "krea2-actions-wrapper";
                                const bgColor = isSelected ? (wc.color || cat.color || '#3498db') : '#2a2a2a';
                                actionsWrapper.style.background = bgColor;
                                actionsWrapper.style.boxShadow = `-8px 0 8px ${bgColor}`;

                                const editWcBtn = document.createElement("span");
                                editWcBtn.className = "krea2-action-btn krea2-edit-btn";
                                editWcBtn.innerHTML = "✎";
                                editWcBtn.title = "Edit Wildcard";

                                const delWcBtn = document.createElement("span");
                                delWcBtn.className = "krea2-action-btn krea2-del-btn";
                                delWcBtn.innerHTML = "&times;";
                                delWcBtn.title = "Delete Wildcard";
                                
                                let wcDelConfirm = false;
                                delWcBtn.onclick = async (e) => {
                                    e.stopPropagation(); 
                                    if (!wcDelConfirm) {
                                        wcDelConfirm = true;
                                        delWcBtn.innerText = "Sure?";
                                        delWcBtn.style.fontSize = "9px";
                                        setTimeout(() => {
                                            wcDelConfirm = false;
                                            delWcBtn.innerHTML = "&times;";
                                            delWcBtn.style.fontSize = "14px";
                                        }, 2000);
                                    } else {
                                        cat.wildcards.splice(wcIndex, 1);
                                        selectedTags.delete(wc.name);
                                        updateOutput();
                                        await saveToServer();
                                        render();
                                    }
                                };

                                const editForm = document.createElement("div");
                                editForm.style.cssText = "display: none; align-items: center; gap: 4px; background: #333; border: 1px solid #f39c12; border-radius: 3px; padding: 2px;";

                                const editNameInput = document.createElement("input");
                                editNameInput.className = "krea2-input";
                                editNameInput.style.width = "60px";
                                editNameInput.value = wc.name;

                                const editValInput = document.createElement("input");
                                editValInput.className = "krea2-input";
                                editValInput.style.width = "100px";
                                editValInput.value = wc.value || wc.name;

                                const saveEditBtn = document.createElement("button");
                                saveEditBtn.innerText = "✓";
                                saveEditBtn.style.cssText = "background: #f39c12; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 3px 6px;";
                                
                                const cancelEditBtn = document.createElement("button");
                                cancelEditBtn.innerText = "X";
                                cancelEditBtn.style.cssText = "background: transparent; color: #bbb; border: none; cursor: pointer; padding: 3px 6px; font-weight: bold;";

                                editWcBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    btn.style.display = "none";
                                    editForm.style.display = "flex";
                                    editNameInput.focus();
                                };

                                cancelEditBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    render();
                                };

                                saveEditBtn.onclick = async (e) => {
                                    e.stopPropagation();
                                    const updatedName = editNameInput.value.trim();
                                    const updatedVal = editValInput.value.trim();
                                    
                                    if (updatedName) {
                                        if (selectedTags.has(wc.name)) {
                                            selectedTags.delete(wc.name);
                                            selectedTags.add(updatedName);
                                        }
                                        wc.name = updatedName;
                                        wc.value = updatedVal || updatedName;
                                        
                                        updateOutput();
                                        await saveToServer();
                                        render();
                                    }
                                };

                                [editNameInput, editValInput].forEach(inp => {
                                    inp.onkeydown = async (e) => {
                                        if (e.key === "Enter") saveEditBtn.onclick(e);
                                        if (e.key === "Escape") cancelEditBtn.onclick(e);
                                    };
                                });

                                editForm.appendChild(editNameInput);
                                editForm.appendChild(editValInput);
                                editForm.appendChild(saveEditBtn);
                                editForm.appendChild(cancelEditBtn);

                                btn.onclick = () => {
                                    if (selectedTags.has(wc.name)) selectedTags.delete(wc.name);
                                    else selectedTags.add(wc.name);
                                    updateOutput();
                                    render();
                                };

                                btn.appendChild(textSpan);
                                
                                actionsWrapper.appendChild(editWcBtn); 
                                actionsWrapper.appendChild(delWcBtn);  
                                btn.appendChild(actionsWrapper);
                                
                                wcNodeWrapper.appendChild(btn);
                                wcNodeWrapper.appendChild(editForm);

                                tagsArea.appendChild(wcNodeWrapper);
                            });
                        }

                        const addWcWrapper = document.createElement("div");
                        addWcWrapper.style.display = "flex";
                        addWcWrapper.style.gap = "4px";

                        const addWcBtn = document.createElement("button");
                        addWcBtn.innerText = "+";
                        addWcBtn.title = "Add wildcard to " + cat.name;
                        addWcBtn.style.cssText = "background: transparent; color: #777; border: 1px dashed #555; border-radius: 3px; cursor: pointer; padding: 4px 10px; font-size: 11px;";

                        const inputForm = document.createElement("div");
                        inputForm.style.cssText = "display: none; align-items: center; gap: 4px; background: #222; border-radius: 3px; padding: 2px;";

                        const nameInput = document.createElement("input");
                        nameInput.className = "krea2-input";
                        nameInput.style.width = "70px";
                        nameInput.placeholder = "Label...";

                        const valInput = document.createElement("input");
                        valInput.className = "krea2-input";
                        valInput.style.width = "120px";
                        valInput.placeholder = "Actual prompt...";

                        const saveWcBtn = document.createElement("button");
                        saveWcBtn.innerText = "✓";
                        saveWcBtn.style.cssText = "background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer; padding: 3px 6px;";
                        
                        const cancelWcBtn = document.createElement("button");
                        cancelWcBtn.innerText = "X";
                        cancelWcBtn.style.cssText = "background: transparent; color: #e74c3c; border: none; cursor: pointer; padding: 3px 6px; font-weight: bold;";

                        addWcBtn.onclick = () => {
                            addWcBtn.style.display = "none";
                            inputForm.style.display = "flex";
                            nameInput.focus();
                        };

                        cancelWcBtn.onclick = () => render();

                        saveWcBtn.onclick = async () => {
                            const newName = nameInput.value.trim();
                            const newVal = valInput.value.trim();
                            
                            if (newName) {
                                if (!cat.wildcards) cat.wildcards = [];
                                cat.wildcards.push({
                                    name: newName,
                                    value: newVal || newName, 
                                    color: cat.color,
                                    image: ""
                                });
                                await saveToServer();
                                render();
                            }
                        };

                        [nameInput, valInput].forEach(inp => {
                            inp.onkeydown = async (e) => {
                                if (e.key === "Enter") saveWcBtn.onclick();
                                if (e.key === "Escape") render();
                            };
                        });

                        inputForm.appendChild(nameInput);
                        inputForm.appendChild(valInput);
                        inputForm.appendChild(saveWcBtn);
                        inputForm.appendChild(cancelWcBtn);

                        addWcWrapper.appendChild(addWcBtn);
                        addWcWrapper.appendChild(inputForm);
                        tagsArea.appendChild(addWcWrapper);

                        catContainer.appendChild(tagsArea);
                        ui.appendChild(catContainer);
                    });
                };

                fetch(`/krea2/wildcards?ts=${Date.now()}`)
                    .then(res => res.json())
                    .then(data => {
                        wildcardsData = data;
                        render();
                    });

                // Attach the Sandbox Wrapper to the ComfyUI Canvas
                this.addDOMWidget("KREA2_UI", "HTML", wrapper, {
                    getValue: () => ui.innerHTML,
                    setValue: (v) => {}
                });

                this.setSize([380, 520]); 
                return r;
            };
        }
    }
});