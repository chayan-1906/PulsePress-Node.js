import {Router} from "express";
import {getAllTopHeadlinesController} from "../controllers/NewsController";

const router = Router();

router.get('/top-headlines', getAllTopHeadlinesController);             // /api/v1/news/top-headlines?country={country}&category={category}&sources={sources}&q={q}&pageSize={pageSize}&page={page}

export default router;
