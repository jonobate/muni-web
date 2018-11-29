from flask import Flask,render_template, request,jsonify,Response
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import scipy.stats as st
import datetime
import boto3

def create_features(df):
    #PROCESS INPUT DATA
    #Convert timestamps
    df['departure_time_hour'] = pd.to_datetime(df['departure_time_hour'])

    #Re-localize time
    df['departure_time_hour'] = df['departure_time_hour'].dt.tz_localize('utc').dt.tz_convert('US/Pacific')

    #Generate local day of week and hour features
    df['dow'] = df['departure_time_hour'].dt.dayofweek
    df['hour'] = df['departure_time_hour'].dt.hour
    df['date'] = df['departure_time_hour'].dt.date

    #Set service IDs
    df['service_id'] = 1
    df['service_id'][df['dow'] == 5] = 2
    df['service_id'][df['dow'] == 6] = 3
    df['service_id'][df['date'] == datetime.date(2018, 11, 22)] = 3
    df['service_id'][df['date'] == datetime.date(2018, 11, 23)] = 3

    df = df.drop(['date'], axis=1)

    #ADD STOP METADATA
    #Append stop metadata
    df_dep = df_stops.copy()
    df_dep = df_dep.add_suffix('_dep')

    df_arr = df_stops.copy()
    df_arr = df_arr.add_suffix('_arr')

    df = df.merge(df_dep, left_on='departure_stop_id', right_on='stop_code_dep')
    df = df.merge(df_arr, left_on='arrival_stop_id', right_on='stop_code_arr')

    df = df.drop(['stop_id_dep', 'stop_id_arr', 'stop_code_dep', 'stop_code_arr'], axis=1)

    #Calculate stop distances
    df['stop_lat_dist'] = (df['stop_lat_dep'] - df['stop_lat_arr'])
    df['stop_lon_dist'] = (df['stop_lon_dep'] - df['stop_lon_arr'])
    df['stop_dist'] = np.sqrt((df['stop_lat_dist']**2) + (df['stop_lon_dist']**2))

    #Drop null columns, drop string/datetime columns
    df = df.dropna(axis='columns', how='all')
    df = df.drop(df.select_dtypes(['object', 'datetime64[ns, US/Pacific]']), axis=1)

    df = df.fillna(0)

    #Reset index
    df = df.reset_index(drop=True)
    return df


# EB looks for an 'application' callable by default.
application = Flask(__name__)

@application.route('/', methods = ['GET'])
def home():
    return render_template('home.html', routes=route_dict)

@application.route('/stops', methods=['POST'])
def get_stops():
    req = request.get_json()
    df_routes_dirs_stops
    df_temp = df_routes_dirs_stops[(df_routes_dirs_stops['route_id'] == int(req['selectedRoute']))
                        & (df_routes_dirs_stops['direction_id'] == int(req['selectedDirection']))]

    stop_dict = [{'value': row['stop_code'],
                    'label': row['stop_name']} for i, row in df_temp.iterrows()]

    return jsonify(stop_dict)

@application.route('/predict', methods=['POST'])
def predict():

    req = request.get_json()

    cols = ['departure_time_hour','departure_stop_id','arrival_stop_id']

    #This example is Castro to Montgomery, all lines
    data = [[req['selectedDate'], int(req['selectedDeparture']), int(req['selectedArrival'])]]
    #data = [['2018-11-21 08:00-08:00', 15728, 15731]]

    df_test = pd.DataFrame(data, columns=cols)

    X_mean = create_features(df_test)

    #Predict means from clf_mean model and add back into test data
    y_mean_pred = pd.DataFrame(clf_mean.predict(X_mean), columns=['mean'])
    X_shape = X_mean.merge(y_mean_pred, left_index=True, right_index=True)

    #Predict means from clf_mean model and add back into test data
    y_shape_pred = pd.DataFrame(clf_shape.predict(X_shape), columns=['shape'])

    df_test = df_test.merge(y_mean_pred, left_index=True, right_index=True)
    df_test = df_test.merge(y_shape_pred, left_index=True, right_index=True)

    dist = st.gamma

    shape = df_test['shape']
    mean = df_test['mean']

    arg = (float(shape),)
    loc = 0
    scale = float(mean)/float(shape)

    # Get sane start and end points of distribution
    start = dist.ppf(0.01, *arg, loc=loc, scale=scale)
    end = dist.ppf(0.99, *arg, loc=loc, scale=scale)

    #Get p50, p99
    p50 = round(dist.ppf(0.50, *arg, loc=loc, scale=scale)/60)

    p95 = round(dist.ppf(0.95, *arg, loc=loc, scale=scale)/60)

    # Build PDF and turn into pandas Series
    x = np.linspace(start, end, 10000)
    y = dist.pdf(x, loc=loc, scale=scale, *arg)

    #Convert seconds to minutes
    x = x/60

    data = list(zip(x, y))
    return jsonify({'data':data, 'p50':p50, 'p95':p95})

# run the app.
if __name__ == "__main__":

    REMOTE = True

    if REMOTE:
        client = boto3.client('s3') #low-level functional API

        #Load some stuff
        print('Loading clf_mean from s3...')
        obj = client.get_object(Bucket='elasticbeanstalk-us-east-1-614550856824', Key='clf_mean_final.pickle')
        clf_mean = pickle.load(open('clf_mean_final.pickle', 'rb'))

        print('Loading clf_shape from s3...')
        obj = client.get_object(Bucket='elasticbeanstalk-us-east-1-614550856824', Key='clf_shape_final.pickle')

    else:
        print('Loading clf_mean...')
        clf_mean = pickle.load(open('clf_mean_final.pickle', 'rb'))

        print('Loading clf_shape...')
        clf_shape = pickle.load(open('clf_shape_final.pickle', 'rb'))

    print('Loading stop data...')
    df_stops = pickle.load(open('df_stops.pickle', 'rb'))
    df_routes = pickle.load(open('df_routes.pickle', 'rb'))
    df_routes = df_routes.sort_values(by=['route_type', 'route_short_name'])
    route_dict = [{'value': row['route_id'],
                    'label': row['route_short_name'] + " - " + row['route_long_name']} for i, row in df_routes.iterrows()]

    # Setting debug to True enables debug output. This line should be
    # removed before deploying a production app.
    application.debug = True
    application.run()
