from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import os
from werkzeug.utils import secure_filename
from model import model_predict

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = 'uploads'

STAR_BRIGHTNESS_MULTIPLIER = 2.0
MAX_STARS_DEFAULT = 1000

CLASSIFICATION_FEATURES = [
    'right_ascens',
    'declination',
    'period',
    'trans_duration',
    'trans_depth',
    'planet_radius',
    'planet_insolation',
    'planet_temp',
    'stellar_temp',
    'stellar_logg',
    'stellar_radius',
    'stellar_mass'
]

os.makedirs('uploads', exist_ok=True)

datasets = {}
current_dataset = None

REQUIRED_COLUMNS = ['star_name', 'planet_name', 'distance_pc', 'right_ascens', 'declination']


def validate_dataframe(df):
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        mapping = {
            'star_name': ['hostname', 'star', 'host'],
            'planet_name': ['pl_name', 'planet', 'name'],
            'distance_pc': ['dist', 'distance', 'st_dist'],
            'right_ascens': ['ra', 'RA', 'right_ascens'],
            'declination': ['dec', 'DEC', 'declination']
        }

        for required_col in missing_cols[:]:
            for existing_col in df.columns:
                if existing_col in mapping.get(required_col, []):
                    df[required_col] = df[existing_col]
                    missing_cols.remove(required_col)
                    break

    return df, missing_cols


def convert_to_earth_centered_coordinates(right_ascens, declination, distance_pc):
    ra_rad = np.radians(right_ascens)
    dec_rad = np.radians(declination)

    x = distance_pc * np.cos(dec_rad) * np.cos(ra_rad)
    y = distance_pc * np.cos(dec_rad) * np.sin(ra_rad)
    z = distance_pc * np.sin(dec_rad)

    return x, y, z


def get_dynamic_filters(df):
    filters = {}

    filter_configs = {
        'stellar_temp': {'label': 'Star Temperature', 'unit': 'K', 'step': 100},
        'period': {'label': 'Orbital Period', 'unit': 'days', 'step': 1},
        'planet_radius': {'label': 'Planet Radius', 'unit': 'R⊕', 'step': 0.5},
        'planet_temp': {'label': 'Planet Temperature', 'unit': 'K', 'step': 50},
        'distance_pc': {'label': 'Distance', 'unit': 'pc', 'step': 5},
        'stellar_mass': {'label': 'Stellar Mass', 'unit': 'M☉', 'step': 0.1},
        'trans_depth': {'label': 'Transit Depth', 'unit': 'ppm', 'step': 100}
    }

    for col, config in filter_configs.items():
        if col in df.columns:
            valid_values = df[col].dropna()
            if len(valid_values) > 0:
                filters[col] = {
                    'min': float(valid_values.min()),
                    'max': float(valid_values.max()),
                    'active': True,
                    'step': config['step'],
                    'label': config['label'],
                    'unit': config['unit']
                }

    return filters


def load_default_dataset():
    default_file = os.path.join(app.config['UPLOAD_FOLDER'], 'default.csv')

    if os.path.exists(default_file):
        try:
            df = pd.read_csv(default_file)

            if df.columns[0] == 'Unnamed: 0' or df.columns[0] == '':
                df = df.iloc[:, 1:]

            df, missing_cols = validate_dataframe(df)

            if missing_cols:
                print(f"Warning: Missing columns: {missing_cols}")
                return None

            df = df.fillna({
                'planet_radius': 1.0,
                'planet_temp': 300,
                'period': 365
            })

            return df
        except Exception as e:
            print(f"Error loading dataset: {e}")
            return None

    return None


default_df = load_default_dataset()
if default_df is not None:
    datasets['default'] = default_df
    current_dataset = 'default'


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/config')
def get_config():
    if current_dataset and current_dataset in datasets:
        df = datasets[current_dataset]
        filters = get_dynamic_filters(df)
    else:
        filters = {}

    return jsonify({
        'filters': filters,
        'current_dataset': current_dataset,
        'available_datasets': list(datasets.keys()),
        'max_stars_default': MAX_STARS_DEFAULT
    })


@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and file.filename.endswith('.csv'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        try:
            df = pd.read_csv(filepath)

            if df.columns[0] == 'Unnamed: 0' or df.columns[0] == '':
                df = df.iloc[:, 1:]

            df, missing_cols = validate_dataframe(df)

            if missing_cols:
                return jsonify({
                    'error': f'Missing columns: {", ".join(missing_cols)}'
                }), 400

            dataset_name = filename.replace('.csv', '')
            datasets[dataset_name] = df
            filters = get_dynamic_filters(df)

            global current_dataset
            current_dataset = dataset_name

            return jsonify({
                'success': True,
                'dataset_name': dataset_name,
                'columns': list(df.columns),
                'filters': filters
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 400

    return jsonify({'error': 'Invalid file format'}), 400


@app.route('/api/data/<dataset_name>')
def get_data(dataset_name):
    if dataset_name == 'default' and 'default' not in datasets:
        default_df = load_default_dataset()
        if default_df is not None:
            datasets['default'] = default_df
        else:
            return jsonify({'error': 'No default dataset available'}), 404

    if dataset_name not in datasets:
        return jsonify({'error': 'Dataset not found'}), 404

    df = datasets[dataset_name]
    filtered_df = df.copy()

    max_stars = MAX_STARS_DEFAULT
    if 'max_stars' in request.args:
        try:
            max_stars = int(request.args.get('max_stars'))
        except:
            pass

    # Apply filters including prediction filter
    for column in request.args:
        if column != 'max_stars' and column in df.columns:
            try:
                min_val, max_val = request.args.get(column).split(',')
                min_val = float(min_val)
                max_val = float(max_val)

                mask = filtered_df[column].notna() & \
                       (filtered_df[column] >= min_val) & \
                       (filtered_df[column] <= max_val)
                filtered_df = filtered_df[mask]
            except:
                value = request.args.get(column)
                mask = filtered_df[column].notna() & (filtered_df[column].map(lambda x: str(x).strip()) == value)
                filtered_df = filtered_df[mask]

    # Group by star and include prediction if available
    agg_dict = {
        'right_ascens': 'first',
        'declination': 'first',
        'distance_pc': 'first',
        'stellar_temp': 'first',
        'stellar_mass': 'first',
        'stellar_radius': 'first',
        'planet_name': 'count'
    }
    planet_names = {
        'planet_name': 'first'
    }

    # Add prediction to aggregation if it exists
    if 'prediction' in filtered_df.columns:
        agg_dict['prediction'] = 'max'  # Take max prediction for the star system

    star_groups = filtered_df.groupby('star_name').agg(agg_dict).reset_index()
    star_groups_planet_names = filtered_df.groupby('star_name').agg(planet_names).reset_index()

    star_groups.rename(columns={'planet_name': 'num_planets'}, inplace=True)
    star_groups = pd.merge(star_groups, star_groups_planet_names, on='star_name', how='left')

    if len(star_groups) > max_stars:
        star_groups = star_groups.sample(n=max_stars, random_state=42)

    data = []
    for _, row in star_groups.iterrows():
        record = {}
        record['star_name'] = row['star_name']
        record['num_planets'] = int(row['num_planets'])

        if all(pd.notna(row[col]) for col in ['right_ascens', 'declination', 'distance_pc']):
            x, y, z = convert_to_earth_centered_coordinates(
                row['right_ascens'], row['declination'], row['distance_pc']
            )
            record['x'] = x
            record['y'] = y
            record['z'] = z
            record['distance_pc'] = float(row['distance_pc'])
            record['right_ascens'] = float(row['right_ascens'])
            record['declination'] = float(row['declination'])
        else:
            continue

        if pd.notna(row['stellar_temp']):
            record['stellar_temp'] = float(row['stellar_temp'])
        if pd.notna(row['stellar_mass']):
            record['stellar_mass'] = float(row['stellar_mass'])
        if pd.notna(row['stellar_radius']):
            record['stellar_radius'] = float(row['stellar_radius'])

        # Add prediction if available
        if 'prediction' in row and pd.notna(row['prediction']):
            record['prediction'] = float(row['prediction'])

        brightness = 0.5
        if row['num_planets'] > 1:
            brightness = min(1.0, 0.5 + (row['num_planets'] - 1) * 0.1)

        record['brightness'] = brightness * STAR_BRIGHTNESS_MULTIPLIER

        data.append(record)

    return jsonify(data)


@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.json
    dataset_name = data.get('dataset', current_dataset)

    if dataset_name == 'default':
        dataset_name = current_dataset

    if dataset_name not in datasets:
        return jsonify({'error': 'Dataset not found'}), 404

    df = datasets[dataset_name]

    try:
        predictions = model_predict(df, CLASSIFICATION_FEATURES)

        df['prediction'] = predictions
        datasets[dataset_name] = df

        preds_list = [float(p) for p in predictions]
        stats = {
            'mean': float(np.mean(predictions)),
            'std': float(np.std(predictions)),
            'min': float(np.min(predictions)),
            'max': float(np.max(predictions))
        }

        return jsonify({
            'success': True,
            'predictions': preds_list,
            'stats': stats
        })
    except Exception as e:
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500


@app.route('/api/star_system/<star_name>')
def get_star_system(star_name):
    for name, df in datasets.items():
        if 'star_name' in df.columns:
            star_data = df[df['star_name'] == star_name]
            if not star_data.empty:
                planets = []
                for _, row in star_data.iterrows():
                    planet_info = {}
                    for col in df.columns:
                        if pd.notna(row[col]):
                            if isinstance(row[col], (int, float, np.integer, np.floating)):
                                planet_info[col] = float(row[col])
                            else:
                                planet_info[col] = str(row[col])
                    planets.append(planet_info)

                star_temp = star_data.iloc[0]['stellar_temp'] if pd.notna(star_data.iloc[0]['stellar_temp']) else 5778

                if star_temp < 3500:
                    color = '#ff6644'
                elif star_temp < 5000:
                    color = '#ffaa44'
                elif star_temp < 6000:
                    color = '#ffff88'
                elif star_temp < 7500:
                    color = '#ffffcc'
                elif star_temp < 10000:
                    color = '#ffffff'
                elif star_temp < 30000:
                    color = '#ccccff'
                else:
                    color = '#aaaaff'

                return jsonify({
                    'star_name': star_name,
                    'star_color': color,
                    'star_temp': star_temp,
                    'planets': planets,
                    'num_planets': len(planets)
                })

    return jsonify({'error': 'Star not found'}), 404


if __name__ == '__main__':
    app.run(debug=True, port=5000)