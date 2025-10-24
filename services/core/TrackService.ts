import { QuestionCondition, QuestionType, TrackingFrequency } from '@/constants/trackTypes';
import { CustomGoalParams, QuestionWithOptions, TrackCategoryWithItems, TrackCategoryWithSelectableItems, TrackItemWithProgress } from '@/services/common/types';
import { getCurrentTimestamp } from '@/services/core/utils';
import { useModel } from '@/services/database/BaseModel';
import { Question, ResponseOption, tables } from '@/services/database/migrations/v1/schema_v1';
import { PatientModel } from '@/services/database/models/PatientModel';
import { QuestionModel } from '@/services/database/models/QuestionModel';
import { ResponseOptionModel } from '@/services/database/models/ResponseOptionModel';
import { TrackCategoryModel } from '@/services/database/models/TrackCategoryModel';
import { TrackItemEntryModel } from '@/services/database/models/TrackItemEntryModel';
import { TrackItemModel } from '@/services/database/models/TrackItemModel';
import { TrackResponseModel } from '@/services/database/models/TrackResponseModel';
import { logger } from '@/services/logging/logger';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Helper function to generate unique codes
const generateUniqueCode = (): string => {
    return uuidv4();
};

// Single shared instance of models
const trackCategoryModel = new TrackCategoryModel();
const trackItemModel = new TrackItemModel();
const questionModel = new QuestionModel();
const responseOptionModel = new ResponseOptionModel();
const trackResponseModel = new TrackResponseModel();
const trackItemEntryModel = new TrackItemEntryModel();
const patientModel = new PatientModel();

const now = getCurrentTimestamp();

// Date helpers (expects and returns MM-DD-YYYY as used in screens today)
function parseMMDDYYYY(dateStr: string): Date {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr);
    const [mm, dd, yyyy] = dateStr.split('-').map((x) => parseInt(x, 10));
    return new Date(yyyy, (mm || 1) - 1, dd || 1);
}

function formatMMDDYYYY(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
}

function getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay(); // 0 Sun, 1 Mon, ...
    const diff = (day === 0 ? -6 : 1 - day); // move to Monday
    date.setDate(date.getDate() + diff);
    return date;
}

export function normalizeDateByFrequency(dateStr: string, frequency: TrackingFrequency): string {
    const date = parseMMDDYYYY(dateStr);
    if (frequency === TrackingFrequency.DAILY) return formatMMDDYYYY(date);
    if (frequency === TrackingFrequency.WEEKLY) return formatMMDDYYYY(getMonday(date));
    // monthly
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    return formatMMDDYYYY(first);
}

function shouldCreateEntryForDate(dateStr: string, frequency: TrackingFrequency): boolean {
    const d = parseMMDDYYYY(dateStr);
    if (frequency === TrackingFrequency.DAILY) return true;
    if (frequency === TrackingFrequency.WEEKLY) {
        return d.getDay() === 1; // Monday
    }
    return d.getDate() === 1; // Monthly -> 1st
}

// Create entry for the selected date only for items the patient has "subscribed" to
// A patient is considered subscribed to an item if there exists any ACTIVE entry for that item
async function ensureSubscribedEntries(patientId: number, date: string): Promise<void> {
    // Get all active items the patient is subscribed to (has any active entry)
    const subscribedItems = await useModel(trackItemModel, async (itemModel: any) => {
        const rows = await itemModel.runQuery(`
            SELECT DISTINCT ti.id, ti.frequency
            FROM ${tables.TRACK_ITEM} ti
            INNER JOIN ${tables.TRACK_CATEGORY} tc ON tc.id = ti.category_id
            INNER JOIN ${tables.TRACK_ITEM_ENTRY} tie ON tie.track_item_id = ti.id
            WHERE tc.status = 'active'
              AND ti.status = 'active'
              AND tie.patient_id = ?
              AND tie.selected = 1
        `, [patientId]);
        return rows as { id: number; frequency: TrackingFrequency }[];
    });

    if (!subscribedItems.length) return;

    // Fetch user_id to create entries
    const patient = await useModel(patientModel, async (pm) => pm.getFirstByFields({ id: patientId }));
    if (!patient) return;

    for (const item of subscribedItems) {
        if (!shouldCreateEntryForDate(date, item.frequency)) continue;
        const normalizedDate = normalizeDateByFrequency(date, item.frequency);
        await useModel(trackItemEntryModel, async (model) => {
            const existing = await model.getFirstByFields({
                track_item_id: item.id,
                patient_id: patientId,
                date: normalizedDate,
            });
            if (!existing) {
                await model.insert({
                    user_id: (patient as any).user_id,
                    patient_id: patientId,
                    track_item_id: item.id,
                    date: normalizedDate,
                    selected: 1,
                    created_date: now,
                    updated_date: now,
                });
            } else if ((existing as any).selected !== 1) {
                // Reactivate if present but inactive
                await model.updateByFields(
                    {
                        selected: 1,
                        updated_date: now
                    },
                    { id: (existing as any).id }
                );
            }
        });
    }
}

export const getTrackCategoriesWithItemsAndProgress = async (
    patientId: number,
    date: string
): Promise<TrackCategoryWithItems[]> => {
    logger.debug('getTrackCategoriesWithItemsAndProgress called', { patientId, date });

    // Lazily ensure entries only for the selected date, for subscribed items
    try { await ensureSubscribedEntries(patientId, date); } catch (e) { logger.debug('ensureSubscribedEntries error', e as any); }

    const categories = await useModel(trackCategoryModel, async (categoryModel) => {
        // Only active categories
        const cats = await categoryModel.getByFields({ status: 'active' } as any);

        const items = await useModel(trackItemModel, async (itemModel: any) => {
            const rows = await itemModel.runQuery(`
        SELECT
          ti.id                     AS item_id,
          tie.id                    AS entry_id,
          ti.name,
          ti.code,
          ti.frequency,
          ti.status,
          ti.category_id,
          ti.created_date,
          ti.updated_date,
          COUNT(DISTINCT r.question_id) AS completed,
          COUNT(DISTINCT q.id)          AS total,
          tie.selected                  AS is_selected
        FROM ${tables.TRACK_ITEM} ti
        INNER JOIN ${tables.TRACK_CATEGORY} tc
          ON tc.id = ti.category_id AND tc.status = 'active'
        -- Only include items that have active questions
        INNER JOIN ${tables.QUESTION} q_check
          ON q_check.item_id = ti.id AND q_check.status = 'active'
        LEFT JOIN ${tables.TRACK_ITEM_ENTRY} tie
          ON tie.track_item_id = ti.id
         AND tie.patient_id = ?
         AND tie.date = ?
        LEFT JOIN ${tables.QUESTION} q
          ON q.item_id = ti.id AND q.status = 'active'
        LEFT JOIN ${tables.TRACK_RESPONSE} r
          ON r.track_item_entry_id = tie.id
          AND tie.date = ?
        WHERE ti.status = 'active'
          AND (
            (tie.selected = 1)
            OR (
              tie.id IS NOT NULL 
              AND EXISTS (
                SELECT 1 
                FROM ${tables.TRACK_RESPONSE} r2
                INNER JOIN ${tables.TRACK_ITEM_ENTRY} tie2
                  ON tie2.id = r2.track_item_entry_id
                  AND tie2.date = ? 
                WHERE r2.track_item_entry_id = tie.id
              )
            )
          )
        GROUP BY tie.id, ti.id, ti.name, ti.code, ti.frequency, ti.status, ti.category_id, ti.created_date, ti.updated_date, tie.selected
      `, [patientId, date, date, date]);
            return rows as any[];
        });

        // Build categories with items + summaries inline
        const result: TrackCategoryWithItems[] = [];

        for (const cat of cats) {
            const catItems: TrackItemWithProgress[] = [];

            for (const row of items.filter((r: any) => r.category_id === cat.id)) {
                const summaries = row.entry_id ? await getSummariesForItem(row.entry_id) : [];
                catItems.push({
                    item: {
                        id: row.item_id,
                        category_id: row.category_id,
                        code: row.code,
                        name: row.name,
                        frequency: row.frequency,
                        status: row.status,
                        created_date: row.created_date,
                        updated_date: row.updated_date,
                    },
                    entry_id: row.entry_id,
                    completed: row.completed,
                    total: row.total,
                    summaries,
                });
            }

            result.push({ ...cat, items: catItems });
        }

        return result;
    });

    logger.debug(
        'getTrackCategoriesWithItemsAndProgress completed',
        JSON.stringify(categories, null, 2)
    );
    return categories;
};

export const getAllCategoriesWithSelectableItems = async (
    patientId: number,
    date: string
): Promise<TrackCategoryWithSelectableItems[]> => {
    logger.debug('getAllCategoriesWithSelectableItems called', { patientId, date });

    return useModel(trackCategoryModel, async (categoryModel) => {
        // Get all ACTIVE categories
        const categories = await categoryModel.getByFields({ status: 'active' } as any);

        // Get all ACTIVE items with a flag if already linked for this patient (ignore date)
        const items = await useModel(trackItemModel, async (itemModel: any) => {
            const result = await itemModel.runQuery(`
                SELECT 
                    ti.id,
                    ti.name,
                    ti.code,
                    ti.frequency,
                    ti.status,
                    ti.created_date,
                    ti.updated_date,
                    ti.category_id,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM ${tables.TRACK_ITEM_ENTRY} tie2
                        WHERE tie2.track_item_id = ti.id
                          AND tie2.patient_id = ?
                          AND tie2.selected = 1
                    ) THEN 1 ELSE 0 END AS selected
                FROM ${tables.TRACK_ITEM} ti
                INNER JOIN ${tables.TRACK_CATEGORY} tc ON tc.id = ti.category_id AND tc.status = 'active'
                WHERE ti.status = 'active'
            `, [patientId]);
            return result as { id: number; name: string; code: string; frequency: string; status: string; created_date: string; updated_date: string; category_id: number; selected: number }[];
        });

        // Group items under categories with "selected" mapped to boolean
        const result: TrackCategoryWithSelectableItems[] = categories.map((cat: any) => ({
            category: cat,
            items: items
                .filter((item) => item.category_id === cat.id)
                .map((item) => ({
                    item: {
                        id: item.id,
                        category_id: item.category_id,
                        code: item.code,
                        name: item.name,
                        frequency: item.frequency as any,
                        status: item.status as any,
                        created_date: item.created_date as any,
                        updated_date: item.updated_date as any,
                    },
                    selected: item.selected === 1
                }))
        }));

        logger.debug('getAllCategoriesWithSelectableItems completed', JSON.stringify(result, null, 2));
        return result;
    });
};

export const getQuestionsWithOptions = async (
    itemId: number,
    entryId: number
): Promise<QuestionWithOptions[]> => {
    logger.debug('getQuestionsWithOptions called', { itemId });

    const result = await useModel(questionModel, async (model) => {
        const questions = await model.getByFields({ item_id: itemId });

        const allOptions = await useModel(responseOptionModel, async (optModel: any) => {
            const result = await optModel.getAll();
            return result as any[];
        });

        // Get existing responses for the given entryId
        const existingResponses = await useModel(trackResponseModel, async (respModel: any) => {
            return await respModel.getByFields({ track_item_entry_id: entryId });
        });

        // Map responses by question_id for fast lookup
        const responseMap = new Map<number, any>();
        for (const resp of existingResponses) {
            responseMap.set(resp.question_id, resp);
        }

        return questions.map((q: any) => ({
            question: {
                ...q,
                parent_question_id: q.parent_question_id ?? null,
                display_condition: q.display_condition ?? null,
            },
            options: allOptions.filter((opt: any) => opt.question_id === q.id),
            existingResponse: responseMap.get(q.id) ?? undefined
        }));

    });

    logger.debug('getQuestionsWithOptions completed', { itemId, entryId }, `${JSON.stringify(result)}`);
    return result;
};

export const saveResponse = async (
    entryId: number,
    questionId: number,
    answer: string,
    userId: string,
    patientId: number
): Promise<void> => {
    logger.debug('saveResponse called', { entryId, questionId, answer });

    const result = await useModel(trackResponseModel, async (model) => {
        const existing = await model.getFirstByFields({
            track_item_entry_id: entryId,
            question_id: questionId,
            user_id: userId,
            patient_id: patientId
        });

        if (existing) {
            await model.updateByFields(
                {
                    answer: JSON.stringify(answer),
                    updated_date: getCurrentTimestamp(),
                },
                {
                    track_item_entry_id: entryId,
                    question_id: questionId,
                    user_id: userId,
                    patient_id: patientId
                }
            );
        } else {
            await model.insert({
                user_id: userId,
                patient_id: patientId,
                question_id: questionId,
                track_item_entry_id: entryId,
                answer: JSON.stringify(answer),
                created_date: getCurrentTimestamp(),
                updated_date: getCurrentTimestamp(),
            });
        }
    });

    logger.debug('saveResponse completed', { entryId, questionId, answer });
    return result;
};

export const addOptionToQuestion = async (
    questionId: number,
    label: string
): Promise<number> => {
    logger.debug('addOptionToQuestion called', { questionId, label });

    const result = await useModel(responseOptionModel, async (model) => {
        const insertResult = await model.insert({
            question_id: questionId,
            text: label,
            created_date: getCurrentTimestamp(),
            updated_date: getCurrentTimestamp(),
        });
        return insertResult.lastInsertRowId;
    });

    logger.debug('addOptionToQuestion completed', { questionId, label, result });
    return result;
};

// Link item to patient/date
export const addTrackItemOnDate = async (
    itemId: number,
    userId: string,
    patientId: number,
    date: string
): Promise<void> => {
    logger.debug('linkItemToPatientDate called', { itemId, patientId, date });

    // Determine item frequency and normalize date accordingly
    const item = await useModel(trackItemModel, async (model) => model.getFirstByFields({ id: itemId }));
    const frequency = item?.frequency || TrackingFrequency.DAILY;
    const normalizedDate = normalizeDateByFrequency(date, frequency);

    await useModel(trackItemEntryModel, async (model) => {
        const existing = await model.getFirstByFields({
            track_item_id: itemId,
            patient_id: patientId,
            date: normalizedDate
        });

        if (existing) {
            // Reactivate if previously inactive
            await model.updateByFields(
                {
                    selected: 1,
                    updated_date: now
                },
                { id: (existing as any).id }
            );
            logger.debug('linkItemToPatientDate: Item reactivated', { itemId, patientId, date: normalizedDate });
            return;
        }

        await model.insert({
            user_id: userId,
            patient_id: patientId,
            track_item_id: itemId,
            date: normalizedDate,
            selected: 1,
            created_date: now,
            updated_date: now,
        });
    });

    logger.debug('linkItemToPatientDate completed', { itemId, patientId, date: normalizedDate });
};

// Unlink item from patient/date
export const removeTrackItemFromDate = async (
    itemId: number,
    userId: string,
    patientId: number,
    date: string
): Promise<void> => {
    logger.debug('unlinkItemFromPatientDate called', { itemId, patientId, date });

    await useModel(trackItemEntryModel, async (model: any) => {
        // 1. Mark all entries as deselected for this item and patient
        await model.updateByFields({ selected: 0, updated_date: now }, { patient_id: patientId, track_item_id: itemId });
    });

    logger.debug('unlinkItemFromPatientDate completed (deselected all future entries and past entries without responses)', { itemId, patientId });
};

export const generateSummary = (template: string, answer: string): string | null => {
    if (!template || !answer) return null;

    try {
        // Optimized: Check if answer is already a string and doesn't need parsing
        let parsed: any;
        if (typeof answer === 'string' && (answer.startsWith('[') || answer.startsWith('{'))) {
            try {
                parsed = JSON.parse(answer);
            } catch {
                parsed = answer;
            }
        } else {
            parsed = answer;
        }

        // Optimized: Handle array case more efficiently
        const result = Array.isArray(parsed) 
            ? template.replace('{{answer}}', parsed.join(', '))
            : template.replace('{{answer}}', String(parsed));
            
        logger.debug(result);
        return result;
    } catch {
        return null;
    }
};

export const getSummariesForItem = async (entryId: number): Promise<string[]> => {
    return useModel(questionModel, async (qModel) => {
        // Optimized: Single query to get all required data in one go
        const mainQuery = await qModel.runQuery(
            `
            SELECT 
                q.*,
                tc.name as category_name,
                r.answer,
                r.updated_date as response_updated_date
            FROM ${tables.QUESTION} q
            INNER JOIN ${tables.TRACK_ITEM_ENTRY} tie ON tie.track_item_id = q.item_id AND tie.id = ?
            INNER JOIN ${tables.TRACK_ITEM} ti ON ti.id = q.item_id
            INNER JOIN ${tables.TRACK_CATEGORY} tc ON tc.id = ti.category_id
            LEFT JOIN ${tables.TRACK_RESPONSE} r ON r.question_id = q.id AND r.track_item_entry_id = ?
            WHERE q.status = 'active'
            ORDER BY q.id
            `,
            [entryId, entryId]
        ) as Array<Question & { category_name: string; answer?: string; response_updated_date?: string }>;

        if (mainQuery.length === 0) return [];

        const isCustom = mainQuery[0].category_name === 'Custom';
        const allQuestions = mainQuery.map(row => ({
            id: row.id,
            item_id: row.item_id,
            code: row.code,
            text: row.text,
            type: row.type,
            required: row.required,
            summary_template: row.summary_template,
            status: row.status,
            created_date: row.created_date,
            updated_date: row.updated_date,
            instructions: row.instructions,
            subtype: row.subtype,
            units: row.units,
            min: row.min,
            max: row.max,
            precision: row.precision,
            parent_question_id: row.parent_question_id,
            display_condition: row.display_condition
        })) as Question[];

        // Optimized: Get options only for questions that have responses (early filtering)
        const questionsWithAnswers = mainQuery.filter(row => 
            row.answer !== undefined && row.answer !== null
        );
        
        if (questionsWithAnswers.length === 0) return [];

        const questionIds = [...new Set(allQuestions.map(q => q.id))]; // Remove duplicates
        const allOptions = questionIds.length > 0 ? await useModel(responseOptionModel, async (optModel: any) => {
            const result = await optModel.runQuery(
                `
                SELECT * FROM ${tables.RESPONSE_OPTION}
                WHERE question_id IN (${questionIds.map(() => '?').join(',')})
                  AND status = 'active'
                `,
                questionIds
            );
            return result as ResponseOption[];
        }) : [];

        // Optimized: Build answer map from main query results
        const answerMap: Record<number, any> = {};
        let lastUpdatedDate: Date | null = null;
        
        for (const row of questionsWithAnswers) {
            answerMap[row.id] = row.answer;
            // Track the most recent update date while building the map
            if (row.response_updated_date) {
                const updateDate = new Date(row.response_updated_date);
                if (!lastUpdatedDate || updateDate > lastUpdatedDate) {
                    lastUpdatedDate = updateDate;
                }
            }
        }

        // For custom goals, return early with just the updated date
        if (isCustom && lastUpdatedDate) {
            return [`Last updated: ${formatMMDDYYYY(lastUpdatedDate)}`];
        }

        // Optimized: Filter and generate summaries in one pass with visibility cache
        const summaries: string[] = [];
        const visibilityCache = new Map<number, boolean>();
        
        for (const question of allQuestions) {
            const answer = answerMap[question.id];
            if (!answer || !question.summary_template) continue;
            
            if (isQuestionVisible(question, answerMap, allQuestions, allOptions, visibilityCache)) {
                const summary = generateSummary(question.summary_template, answer);
                if (summary) summaries.push(summary);
            }
        }
        
        return summaries;
    });
};

/**
 * ------------------------------------------------------------------------------------------------------------
 * NOTE: Conditional logic previously used value-based checks, e.g., {"equals": "yes"}.
 * Now updated to use option codes instead, e.g., {"equals": "o_yes"} for MSQ/MCQ types.
 * Service layer update is pending and will be handled in a follow-up PR.
 * ------------------------------------------------------------------------------------------------------------
 */

// Utility to check if a question is visible given current answers
export const isQuestionVisible = (
    q: Question,
    answers: Record<number, any>,
    allQuestions?: Question[],
    allOptions?: ResponseOption[],
    visibilityCache?: Map<number, boolean>
): boolean => {
    // Use cache to avoid redundant calculations
    if (visibilityCache?.has(q.id)) {
        return visibilityCache.get(q.id)!;
    }

    if (!q.parent_question_id || !q.display_condition) {
        visibilityCache?.set(q.id, true);
        return true;
    }

    // First, check if the parent question itself is visible (cascading visibility)
    const parentQuestion = allQuestions?.find(question => question.id === q.parent_question_id);
    if (parentQuestion && !isQuestionVisible(parentQuestion, answers, allQuestions, allOptions, visibilityCache)) {
        visibilityCache?.set(q.id, false);
        return false;
    }

    let result = true;
    try {
        const cond = JSON.parse(q.display_condition);
        const parentAnswer = answers[q.parent_question_id];
        
        // Optimized: Parse answer once and handle undefined/null early
        let parsedParentAnswer: any;
        if (parentAnswer === undefined || parentAnswer === null) {
            parsedParentAnswer = parentAnswer;
        } else {
            try {
                parsedParentAnswer = JSON.parse(parentAnswer);
            } catch {
                parsedParentAnswer = parentAnswer;
            }
        }

        // Handle parent_answered condition using enum
        if (cond[QuestionCondition.PARENT_RES_EXISTS] === true) {
            result = (
                parsedParentAnswer !== undefined &&
                parsedParentAnswer !== null &&
                parsedParentAnswer !== "" &&
                (!Array.isArray(parsedParentAnswer) || parsedParentAnswer.length > 0)
            );
            visibilityCache?.set(q.id, result);
            return result;
        }

        // Optimized: Early return if no parent answer for other conditions
        if (parsedParentAnswer === undefined || parsedParentAnswer === null) {
            visibilityCache?.set(q.id, false);
            return false;
        }

        const parentQuestionType = parentQuestion?.type;

        // Map text values to option codes for boolean, multi-choice, and multi-select questions
        if (parentQuestionType &&
            (parentQuestionType === QuestionType.BOOLEAN ||
                parentQuestionType === QuestionType.MCQ ||
                parentQuestionType === QuestionType.MSQ) &&
            allOptions?.length) {

            // Optimized: Filter options once
            const parentOptions = allOptions.filter(opt => opt.question_id === q.parent_question_id);

            if (Array.isArray(parsedParentAnswer)) {
                // Handle multi-select case
                parsedParentAnswer = parsedParentAnswer.map(answer => {
                    const matchingOption = parentOptions.find(opt => opt.text === answer);
                    return matchingOption ? matchingOption.code : answer;
                });
            } else if (typeof parsedParentAnswer === 'string') {
                // Handle boolean and multi-choice case
                const matchingOption = parentOptions.find(opt => opt.text === parsedParentAnswer);
                if (matchingOption) {
                    parsedParentAnswer = matchingOption.code;
                }
            }
        }

        const numericAnswer = Number(parsedParentAnswer);

        // Optimized: Direct condition checks instead of array iteration
        if (cond[QuestionCondition.EQ] !== undefined) {
            result = Array.isArray(parsedParentAnswer) 
                ? parsedParentAnswer.includes(cond[QuestionCondition.EQ]) 
                : parsedParentAnswer === cond[QuestionCondition.EQ];
        } else if (cond[QuestionCondition.NOT_EQ] !== undefined) {
            result = Array.isArray(parsedParentAnswer) 
                ? !parsedParentAnswer.includes(cond[QuestionCondition.NOT_EQ]) 
                : parsedParentAnswer !== cond[QuestionCondition.NOT_EQ];
        } else if (cond[QuestionCondition.GT] !== undefined) {
            result = !isNaN(numericAnswer) && numericAnswer > Number(cond[QuestionCondition.GT]);
        } else if (cond[QuestionCondition.GTE] !== undefined) {
            result = !isNaN(numericAnswer) && numericAnswer >= Number(cond[QuestionCondition.GTE]);
        } else if (cond[QuestionCondition.LT] !== undefined) {
            result = !isNaN(numericAnswer) && numericAnswer < Number(cond[QuestionCondition.LT]);
        } else if (cond[QuestionCondition.LTE] !== undefined) {
            result = !isNaN(numericAnswer) && numericAnswer <= Number(cond[QuestionCondition.LTE]);
        } else if (cond[QuestionCondition.IN] !== undefined) {
            const values = cond[QuestionCondition.IN];
            result = Array.isArray(values) && (Array.isArray(parsedParentAnswer) ?
                values.some(val => parsedParentAnswer.includes(val)) :
                values.includes(parsedParentAnswer));
        } else if (cond[QuestionCondition.NOT_IN] !== undefined) {
            const values = cond[QuestionCondition.NOT_IN];
            result = Array.isArray(values) && (Array.isArray(parsedParentAnswer) ?
                !values.some(val => parsedParentAnswer.includes(val)) :
                !values.includes(parsedParentAnswer));
        }

    } catch (err) {
        console.warn("Invalid display_condition JSON:", q.display_condition, err);
        result = true;
    }

    visibilityCache?.set(q.id, result);
    return result;
};

/*
 Custom Goals methods :
*/

export const addCustomGoal = async (params: CustomGoalParams): Promise<number> => {
    const { name, patientId, date, frequency, questions } = params;
    logger.debug('addCustomGoal called', { name, patientId, date, frequency });

    // Find the Custom category ID
    const customCategoryId = await useModel(trackCategoryModel, async (model) => {
        const category = await model.getFirstByFields({ name: 'Custom' });
        if (!category) {
            throw new Error('Custom category not found');
        }
        return category.id;
    });

    // Generate a unique code for this track item
    const trackItemCode = generateUniqueCode();

    // Create a new track item for the custom goal
    const trackItemId = await useModel(trackItemModel, async (model) => {
        const result = await model.insert({
            name,
            code: trackItemCode,
            frequency: frequency as any,
            category_id: customCategoryId,
            status: 'active' as any,
            created_date: now,
            updated_date: now,
        });
        return result.lastInsertRowId;
    });

    // Create questions for the custom goal
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];

        // Generate a unique code for each question
        const questionCode = generateUniqueCode();

        const questionId = await useModel(questionModel, async (model) => {
            const result = await model.insert({
                item_id: trackItemId,
                code: questionCode,
                text: question.text,
                type: question.type as any,
                required: question.required ? 1 : 0,
                status: 'active' as any,
                created_date: now,
                updated_date: now,
            });
            return result.lastInsertRowId;
        });

        // If question type is mcq, msq, or boolean, add default/options
        if (question.type === QuestionType.BOOLEAN || question.type === 'boolean') {
            await useModel(responseOptionModel, async (model) => {
                await model.insert({
                    question_id: questionId,
                    code: generateUniqueCode(),
                    text: 'Yes',
                    status: 'active' as any,
                    created_date: now,
                    updated_date: now,
                });
                await model.insert({
                    question_id: questionId,
                    code: generateUniqueCode(),
                    text: 'No',
                    status: 'active' as any,
                    created_date: now,
                    updated_date: now,
                });
            });
        } else if (
            question && (question.type === QuestionType.MCQ || question.type === QuestionType.MSQ || question.type === 'mcq' || question.type === 'msq') &&
            Array.isArray(question.options)
        ) {
            const cleanOptions = question.options.filter((o) => !!o && o.trim().length > 0);
            if (cleanOptions.length > 0) {
                await useModel(responseOptionModel, async (model) => {
                    for (let j = 0; j < cleanOptions.length; j++) {
                        const opt = cleanOptions[j];
                        await model.insert({
                            question_id: questionId,
                            code: generateUniqueCode(),
                            text: opt.trim(),
                            status: 'active' as any,
                            created_date: now,
                            updated_date: now,
                        });
                    }
                });
            }
        }
    }
    logger.debug('addCustomGoal completed', { trackItemId, name, patientId, date, frequency });
    return trackItemId;
};

export const editCustomGoal = async (
    trackItemId: number,
    updates: {
        name?: string;
        questions?: {
            id?: number;
            text: string;
            type: string;
            required?: boolean;
            options?: string[];
        }[];
    }
): Promise<void> => {
    logger.debug('editCustomGoal called', { trackItemId, updates });

    // Update name if provided
    if (updates.name) {
        await useModel(trackItemModel, async (model) => {
            await model.updateByFields(
                { name: updates.name, updated_date: now },
                { id: trackItemId }
            );
        });
    }

    // Handle questions
    if (updates.questions && updates.questions.length > 0) {
        for (const q of updates.questions) {
            if (q.id) {
                // Update existing question
                await useModel(questionModel, async (model) => {
                    await model.updateByFields(
                        {
                            text: q.text,
                            type: q.type as any,
                            required: q.required ? 1 : 0,
                            updated_date: now,
                        },
                        { id: q.id }
                    );
                });

                if (q.options) {
                    // Replace options
                    await useModel(responseOptionModel, async (model) => {
                        await model.deleteByFields({ question_id: q.id as any });
                        const opts = q.options ?? [];
                        for (const opt of opts) {
                            await model.insert({
                                code: generateUniqueCode(),
                                question_id: q.id,
                                text: opt.trim(),
                                status: 'active' as any,
                                created_date: now,
                                updated_date: now,
                            });
                        }
                    });
                }
            } else {
                // Insert new question
                const questionId = await useModel(questionModel, async (model) => {
                    const result = await model.insert({
                        code: `Q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        item_id: trackItemId,
                        text: q.text,
                        type: q.type as any,
                        required: q.required ? 1 : 0,
                        status: 'active' as any,
                        created_date: now,
                        updated_date: now,
                    });
                    return result.lastInsertRowId;
                });

                if (q.options) {
                    await useModel(responseOptionModel, async (model) => {
                        const opts = q.options ?? [];
                        for (const opt of opts) {
                            await model.insert({
                                code: `RESP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                question_id: questionId,
                                text: opt.trim(),
                                status: 'active' as any,
                                created_date: now,
                                updated_date: now,
                            });
                        }
                    });
                }
            }
        }
    }

    logger.debug('editCustomGoal completed', { trackItemId });
};

export const removeCustomGoal = async (
    trackItemId: number,
    patientId: number
): Promise<void> => {
    logger.debug('removeCustomGoal called', { trackItemId, patientId });

    // Deactivate the track item itself
    await useModel(trackItemModel, async (model) => {
        await model.updateByFields(
            { status: 'inactive' as any, updated_date: now },
            { id: trackItemId }
        );
    });

    // Deactivate linked entries for this patient
    await useModel(trackItemEntryModel, async (model) => {
        await model.updateByFields(
            { selected: 0 as any, updated_date: now },
            { track_item_id: trackItemId, patient_id: patientId }
        );
    });

    logger.debug('removeCustomGoal completed', { trackItemId, patientId });
};