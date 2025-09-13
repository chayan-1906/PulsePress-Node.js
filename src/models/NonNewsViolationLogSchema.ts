import {Document, Model, model, Schema} from "mongoose";
import {TViolationType, VIOLATION_TYPES} from "../types/ai";

export interface INonNewsViolationLog extends Document {
    userExternalId: string;
    email: string;
    violationType: TViolationType;
    content: string;
    violatedAt: Date;
}

interface INonNewsViolationLogModel extends Model<INonNewsViolationLog> {
}

const NonNewsViolationLogSchema = new Schema<INonNewsViolationLog>({
    userExternalId: {
        type: String,
        required: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        index: true,
    },
    violationType: {
        type: String,
        required: true,
        enum: VIOLATION_TYPES,
    },
    content: {
        type: String,
        required: true,
        maxlength: 2000,
    },
    violatedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.id = String(ret._id);
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;
            return ret;
        },
    },
});

NonNewsViolationLogSchema.index({email: 1, violatedAt: -1});

const NonNewsViolationLogModel: INonNewsViolationLogModel = model<INonNewsViolationLog, INonNewsViolationLogModel>('NonNewsViolationLog', NonNewsViolationLogSchema);

export default NonNewsViolationLogModel;
