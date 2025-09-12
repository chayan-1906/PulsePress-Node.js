import {Document, Model, model, Schema} from "mongoose";
import {API_SERVICES, TApiService} from "../types/quota";

export interface IApiQuota extends Document {
    service: TApiService;
    date: string;
    requestCount: number;
    lastResetAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

interface IApiQuotaModel extends Model<IApiQuota> {
}

const ApiQuotaSchema = new Schema<IApiQuota>({
    service: {
        type: String,
        required: true,
        enum: API_SERVICES,
    },
    date: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2}$/,   // YYYY-MM-DD format validation
    },
    requestCount: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    lastResetAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;

            return ret;
        },
    },
});

ApiQuotaSchema.index({service: 1}, {unique: true});

const ApiQuotaModel: IApiQuotaModel = model<IApiQuota, IApiQuotaModel>('ApiQuota', ApiQuotaSchema);

export default ApiQuotaModel;
