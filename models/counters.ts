import { Schema, model } from 'mongoose';

const Counter = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

export = model('Counter', Counter);
