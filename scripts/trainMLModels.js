// scripts/trainMLModels.js
const tf = require('@tensorflow/tfjs-node');
const mongoose = require('mongoose');
const PredictiveAnalytics = require('../models/PredictiveAnalytics.model');
const UserJourney = require('../models/UserJourney.model');

class MLTrainer {
  constructor() {
    this.models = {
      churn: null,
      conversion: null,
      ltv: null
    };
  }

  // Prepare training data for churn prediction
  async prepareChurnData() {
    const journeys = await UserJourney.find().lean();
    
    const features = journeys.map(j => [
      j.totalSteps,
      j.totalDuration,
      j.bounceRate,
      j.avgTimePerStep,
      j.conversionRate,
      j.exitRate
    ]);
    
    const labels = journeys.map(j => j.bounceRate > 70 ? 1 : 0);
    
    return {
      features: tf.tensor2d(features),
      labels: tf.tensor2d(labels, [labels.length, 1])
    };
  }

  // Build churn prediction model
  buildChurnModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [6], units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }

  // Train churn model
  async trainChurnModel() {
    console.log('Training churn prediction model...');
    
    const { features, labels } = await this.prepareChurnData();
    const model = this.buildChurnModel();
    
    await model.fit(features, labels, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
        }
      }
    });
    
    await model.save('file://./ml-models/churn');
    this.models.churn = model;
    
    console.log('✅ Churn model trained and saved');
  }

  // Prepare conversion data
  async prepareConversionData() {
    const journeys = await UserJourney.find().lean();
    
    const features = journeys.map(j => [
      j.totalSteps,
      j.totalDuration,
      j.avgTimePerStep,
      j.interactions || 0,
      j.scrollDepth || 0,
      j.clickRate || 0
    ]);
    
    const labels = journeys.map(j => j.conversionRate > 50 ? 1 : 0);
    
    return {
      features: tf.tensor2d(features),
      labels: tf.tensor2d(labels, [labels.length, 1])
    };
  }

  // Train conversion model
  async trainConversionModel() {
    console.log('Training conversion prediction model...');
    
    const { features, labels } = await this.prepareConversionData();
    const model = this.buildChurnModel(); // Same architecture
    
    await model.fit(features, labels, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2
    });
    
    await model.save('file://./ml-models/conversion');
    this.models.conversion = model;
    
    console.log('✅ Conversion model trained and saved');
  }

  // Build LTV regression model
  buildLTVModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [8], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'linear' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    return model;
  }

  // Predict churn for user
  async predictChurn(userFeatures) {
    if (!this.models.churn) {
      this.models.churn = await tf.loadLayersModel('file://./ml-models/churn/model.json');
    }
    
    const input = tf.tensor2d([userFeatures]);
    const prediction = this.models.churn.predict(input);
    const churnProbability = (await prediction.data())[0];
    
    return Math.round(churnProbability * 100);
  }

  // Predict conversion
  async predictConversion(userFeatures) {
    if (!this.models.conversion) {
      this.models.conversion = await tf.loadLayersModel('file://./ml-models/conversion/model.json');
    }
    
    const input = tf.tensor2d([userFeatures]);
    const prediction = this.models.conversion.predict(input);
    const conversionProbability = (await prediction.data())[0];
    
    return Math.round(conversionProbability * 100);
  }

  // Train all models
  async trainAll() {
    await this.trainChurnModel();
    await this.trainConversionModel();
    console.log('✅ All ML models trained successfully');
  }
}

// Run training
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    .then(async () => {
      const trainer = new MLTrainer();
      await trainer.trainAll();
      process.exit(0);
    })
    .catch(err => {
      console.error('Training failed:', err);
      process.exit(1);
    });
}

module.exports = MLTrainer;
