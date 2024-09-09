class MapHandler {
    constructor() {
        this.map = new ol.Map({
            target: 'map-container',
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.OSM()
                })
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([35, 39]), // Türkiye merkez
                zoom: 6
            })
        });

        this.vectorSource = new ol.source.Vector();
        this.vectorLayer = new ol.layer.Vector({
            source: this.vectorSource,
            style: (feature) => {
                const type = feature.getGeometry().getType();
                let style;
                if (type === 'Point') {
                    style = new ol.style.Style({
                        image: new ol.style.Icon({
                            src: 'https://cdn1.iconfinder.com/data/icons/basic-ui-elements-coloricon/21/06_1-1024.png',
                            scale: 0.05
                        })
                    });
                } else if (type === 'LineString') {
                    style = new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: '#ffcc00',
                            width: 2
                        })
                    });
                } else if (type === 'Polygon') {
                    style = new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: '#ffcc00',
                            width: 2
                        }),
                        fill: new ol.style.Fill({
                            color: 'rgba(255, 255, 0, 0.2)'
                        })
                    });
                }
                return style;
            }
        });
        this.map.addLayer(this.vectorLayer);

         // Pop-up'lar

        this.selectedFeature = null;
        this.overlay = new ol.Overlay({
            element: document.getElementById('popup'),
            autoPan: true,
            positioning: 'bottom-center',
            stopEvent: true,
            offset: [0, -10],
        });
        this.map.addOverlay(this.overlay);

        this.initEventListeners();
    }

    initEventListeners() {
        // Add Point Butonuna Tıklama
        document.getElementById('add-point').addEventListener('click', () => {
            this.map.once('click', (event) => {
                const coordinates = ol.proj.toLonLat(event.coordinate);
                document.getElementById('x-coordinate').value = coordinates[0].toFixed(6);
                document.getElementById('y-coordinate').value = coordinates[1].toFixed(6);
                this.showPopup('popup');
            });
        });
        
        // Nokta Ekleme Formu

        document.getElementById('point-form').onsubmit = (e) => {
            e.preventDefault();
            this.addPointToMap();
        };

        // Sorgu Butonuna Tıklama

        document.getElementById('feature-form').onsubmit = (e) => {
            e.preventDefault();
            this.addFeatureToMap();
        };

        // Popup'ları Kapatma

        document.getElementById('query').onclick = () => {
            this.loadFeaturesFromAPI();
            this.showPopup('query-panel');
        };

        document.getElementById('close-query').onclick = () => {
            this.hidePopup('query-panel');
        };

        document.getElementById('cancel-button').onclick = () => {
            this.hidePopup('popup');
        };

        document.getElementById('cancel-feature-button').onclick = () => {
            this.hidePopup('feature-popup');
        };

        this.map.on('pointermove', (event) => {
            if (this.selectedFeature) {
                const coordinates = event.coordinate;
                this.selectedFeature.getGeometry().setCoordinates(coordinates);
                const lonLat = ol.proj.toLonLat(coordinates);
                document.getElementById('x-coordinate').value = lonLat[0].toFixed(6);
                document.getElementById('y-coordinate').value = lonLat[1].toFixed(6);
            }
        });

        this.map.on('click', (event) => {
            if (this.selectedFeature) {
                this.selectedFeature = null;
            }
        });
    }

    addPointToMap() {
        const x = parseFloat(document.getElementById('x-coordinate').value);
        const y = parseFloat(document.getElementById('y-coordinate').value);
        const pointName = document.getElementById('point-name').value;

        if (!pointName) {
            alert('Lütfen bir isim giriniz.');
            return;
        }

        const feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([x, y])),
            name: pointName
        });

        this.vectorSource.addFeature(feature);
        this.saveFeatureToAPI(x, y, pointName, 'Point');

        this.hidePopup('popup');
    }

    addFeatureToMap() {
        const featureName = document.getElementById('feature-name').value;
        const featureType = this.currentFeatureType; // 'LineString' veya 'Polygon'

        if (!featureName) {
            alert('Lütfen bir isim giriniz.');
            return;
        }

        const coordinates = this.featureCoordinates; // Harita üzerinde seçilen koordinatlar

        let feature;
        if (featureType === 'LineString') {
            feature = new ol.Feature({
                geometry: new ol.geom.LineString(coordinates),
                name: featureName
            });
        } else if (featureType === 'Polygon') {
            feature = new ol.Feature({
                geometry: new ol.geom.Polygon([coordinates]),
                name: featureName
            });
        }

        this.vectorSource.addFeature(feature);
        this.saveFeatureToAPI(coordinates, featureName, featureType);

        this.hidePopup('feature-popup');
    }

    saveFeatureToAPI(coordinates, name, type) {
        fetch('https://localhost:7134/api/points', {  // API endpoint'i güncellenmeli
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                type: type,
                coordinates: coordinates
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Başarıyla kaydedildi:', data);
        })
        .catch((error) => {
            console.error('Hata:', error);
        });
    }

    loadFeaturesFromAPI() {
        fetch('https://localhost:7134/api/points')  // API endpoint'i güncellenmeli
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(features => {
            const tableBody = document.querySelector('#points-table tbody');
            tableBody.innerHTML = '';
            features.forEach(feature => {
                let featureGeometry;
                if (feature.type === 'Point') {
                    featureGeometry = new ol.geom.Point(ol.proj.fromLonLat([feature.x, feature.y]));
                } else if (feature.type === 'LineString') {
                    featureGeometry = new ol.geom.LineString(feature.coordinates.map(coord => ol.proj.fromLonLat(coord)));
                } else if (feature.type === 'Polygon') {
                    featureGeometry = new ol.geom.Polygon([feature.coordinates.map(coord => ol.proj.fromLonLat(coord))]);
                }
    
                const olFeature = new ol.Feature({
                    geometry: featureGeometry,
                    name: feature.name
                });
                this.vectorSource.addFeature(olFeature);
    
                const row = document.createElement('tr');
                row.innerHTML = `<td>${feature.type}</td><td>${feature.name}</td><td>${feature.coordinates ? feature.coordinates.join(', ') : ''}</td>
                                 <td><button onclick="updateFeature('${feature.name}')">Güncelle</button></td>`;
                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Hata:', error);
        });
    }
    

    showPopup(id) {
        document.getElementById(id).style.display = 'block';
    }

    hidePopup(id) {
        document.getElementById(id).style.display = 'none';
    }
}

const mapHandler = new MapHandler();
