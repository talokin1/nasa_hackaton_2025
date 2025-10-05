const InputModule = {
    currentDataset: 'default',
    filters: {},
    originalFilters: {},
    maxStars: 1000,
    showBackground: true,
    hasPredictions: false,

    init() {
        this.setupEventListeners();
        this.loadConfiguration();
    },

    setupEventListeners() {
        document.getElementById('dataset-select').addEventListener('change', (e) => {
            this.handleDatasetChange(e.target.value);
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetFilters();
        });

        document.getElementById('predict-btn').addEventListener('click', () => {
            this.runPrediction();
        });

        const maxStarsInput = document.getElementById('max-stars');
        const maxStarsSlider = document.getElementById('max-stars-slider');

        maxStarsInput.addEventListener('change', (e) => {
            this.maxStars = parseInt(e.target.value);
            maxStarsSlider.value = e.target.value;
            GalaxyModule.loadData(this.getActiveFilters());
        });

        maxStarsSlider.addEventListener('input', (e) => {
            this.maxStars = parseInt(e.target.value);
            maxStarsInput.value = e.target.value;
            GalaxyModule.loadData(this.getActiveFilters());
        });

        document.getElementById('show-background').addEventListener('change', (e) => {
            this.showBackground = e.target.checked;
            GalaxyModule.toggleBackground(this.showBackground);
        });

        // Setup prediction filter listeners
        const predMinInput = document.getElementById('prediction-min');
        const predMaxInput = document.getElementById('prediction-max');

        if (predMinInput && predMaxInput) {
            predMinInput.addEventListener('change', () => {
                if (this.hasPredictions) {
                    GalaxyModule.loadData(this.getActiveFilters());
                }
            });

            predMaxInput.addEventListener('change', () => {
                if (this.hasPredictions) {
                    GalaxyModule.loadData(this.getActiveFilters());
                }
            });
        }
    },

    async loadConfiguration() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();

            this.filters = config.filters;
            this.originalFilters = JSON.parse(JSON.stringify(config.filters));
            this.currentDataset = config.current_dataset || 'default';
            this.maxStars = config.max_stars_default || 1000;

            document.getElementById('max-stars').value = this.maxStars;
            document.getElementById('max-stars-slider').value = this.maxStars;

            const select = document.getElementById('dataset-select');
            select.innerHTML = '<option value="default">Default Dataset</option>';

            config.available_datasets.forEach(name => {
                if (name !== 'default') {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name.charAt(0).toUpperCase() + name.slice(1);
                    select.appendChild(option);
                }
            });
            select.innerHTML += '<option value="custom">Upload Dataset</option>';

            this.renderFilters();
            GalaxyModule.loadData(this.getActiveFilters());
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
    },

    renderFilters() {
        const container = document.getElementById('filters-container');
        container.innerHTML = '';

        Object.entries(this.filters).forEach(([key, config]) => {
            const filterDiv = document.createElement('div');
            filterDiv.className = 'filter-item';
            filterDiv.id = `filter-${key}`;

            filterDiv.innerHTML = `
                <div class="filter-name">${config.label} ${config.unit ? `(${config.unit})` : ''}</div>
                <div class="filter-range">
                    <label>Min:</label>
                    <input type="number" class="filter-input" id="${key}-min"
                           value="${config.min.toFixed(0)}" step="${config.step}">
                    <label>Max:</label>
                    <input type="number" class="filter-input" id="${key}-max"
                           value="${config.max.toFixed(0)}" step="${config.step}">
                </div>
            `;

            container.appendChild(filterDiv);
            this.setupFilterListeners(key);
        });
    },

    setupFilterListeners(filterKey) {
        const minInput = document.getElementById(`${filterKey}-min`);
        const maxInput = document.getElementById(`${filterKey}-max`);

        const updateData = () => {
            GalaxyModule.loadData(this.getActiveFilters());
        };

        minInput?.addEventListener('change', updateData);
        maxInput?.addEventListener('change', updateData);
    },

    getActiveFilters() {
        const filters = {};

        // Regular filters
        Object.keys(this.filters).forEach(key => {
            const min = document.getElementById(`${key}-min`)?.value;
            const max = document.getElementById(`${key}-max`)?.value;
            if (min !== undefined && max !== undefined) {
                filters[key] = `${min},${max}`;
            }
        });

        // Prediction filter (if predictions have been run)
        if (this.hasPredictions) {
            const predMin = document.getElementById('prediction-min')?.value;
            const predMax = document.getElementById('prediction-max')?.value;
            if (predMin !== undefined && predMax !== undefined) {
                filters['prediction'] = `${predMin},${predMax}`;
            }
        }

        filters.max_stars = this.maxStars;
        return filters;
    },

    resetFilters() {
        Object.entries(this.originalFilters).forEach(([key, config]) => {
            const minInput = document.getElementById(`${key}-min`);
            const maxInput = document.getElementById(`${key}-max`);

            if (minInput) minInput.value = config.min.toFixed(0);
            if (maxInput) maxInput.value = config.max.toFixed(0);
        });

        // Reset prediction filter if it exists
        if (this.hasPredictions) {
            const predMin = document.getElementById('prediction-min');
            const predMax = document.getElementById('prediction-max');
            if (predMin) predMin.value = '0';
            if (predMax) predMax.value = '1';
        }

        GalaxyModule.loadData(this.getActiveFilters());
    },

    handleDatasetChange(value) {
        if (value === 'custom') {
            document.getElementById('file-input-wrapper').style.display = 'block';
        } else {
            document.getElementById('file-input-wrapper').style.display = 'none';
            this.currentDataset = value;
            this.hasPredictions = false;
            this.hidePredictionFilter();
            GalaxyModule.loadData(this.getActiveFilters());
        }
    },

    async handleFileUpload(file) {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        GalaxyModule.showLoader(true);
        GalaxyModule.showStatus('Uploading dataset...', 'info');

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.currentDataset = data.dataset_name;
                this.filters = data.filters;
                this.originalFilters = JSON.parse(JSON.stringify(data.filters));
                this.hasPredictions = false;
                this.hidePredictionFilter();
                this.renderFilters();

                const select = document.getElementById('dataset-select');
                const option = document.createElement('option');
                option.value = data.dataset_name;
                option.textContent = data.dataset_name;
                select.insertBefore(option, select.lastElementChild);
                select.value = data.dataset_name;

                GalaxyModule.showStatus('Dataset uploaded successfully!', 'success');
                GalaxyModule.loadData(this.getActiveFilters());
            } else {
                GalaxyModule.showStatus(`Error: ${data.error}`, 'error');
            }
        } catch (error) {
            GalaxyModule.showStatus(`Upload failed: ${error.message}`, 'error');
        } finally {
            GalaxyModule.showLoader(false);
        }
    },

    showPredictionFilter() {
        const section = document.getElementById('prediction-filter-section');
        if (section) {
            section.style.display = 'block';
        }
    },

    hidePredictionFilter() {
        const section = document.getElementById('prediction-filter-section');
        if (section) {
            section.style.display = 'none';
        }
    },

    async runPrediction() {
        const btn = document.getElementById('predict-btn');
        btn.disabled = true;
        GalaxyModule.showLoader(true);
        GalaxyModule.showStatus('Running predictions...', 'info');

        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset: this.currentDataset })
            });

            const data = await response.json();

            if (data.success) {
                this.hasPredictions = true;
                this.showPredictionFilter();

                GalaxyModule.showStatus(
                    `Predictions complete! Mean: ${data.stats.mean.toFixed(3)}, Std: ${data.stats.std.toFixed(3)}`,
                    'success'
                );

                // Reload data to show colored predictions
                GalaxyModule.loadData(this.getActiveFilters());
            } else {
                GalaxyModule.showStatus(`Error: ${data.error}`, 'error');
            }
        } catch (error) {
            GalaxyModule.showStatus(`Prediction failed: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            GalaxyModule.showLoader(false);
        }
    }
};