export function useQuestionLogic() {
  /**
   * Evaluates if a question should be visible based on its conditions and parent state
   */
  const evaluateCondition = (answer: any, condition: any): boolean => {
    if (answer === undefined || answer === null || answer === '') return false;

    // Normalize condition to an array for easier checking if needed
    const conditions = Array.isArray(condition) ? condition : [condition];

    const isMatch = (val: any) => {
        return conditions.some(c => String(val).toLowerCase() === String(c).toLowerCase());
    };

    // Handle stringified objects (e.g., chassis inspection status or zone objects)
    if (typeof answer === 'object' && answer !== null) {
      // Check if any property value matches any of the conditions
      return Object.values(answer).some(val => isMatch(val));
    }

    if (Array.isArray(answer)) {
      return answer.some(val => isMatch(val));
    }

    // Direct comparison
    return isMatch(answer);
  };

  /**
   * Recursively flattens and filters questions based on conditional logic
   * Supports both sibling-based showWhen and nested followUpQuestions
   */
  const getOrderedVisibleQuestions = (
    questions: any[],
    answers: Record<string, any>
  ): any[] => {
    const visibleResults: any[] = [];
    const processedIds = new Set<string>();

    const processQuestions = (list: any[]) => {
      if (!list || !Array.isArray(list)) return;

      list.forEach(q => {
        const qId = q.id || q._id;
        if (!qId || processedIds.has(qId)) return;

        // 1. Determine if this specific question itself should be shown
        let isVisible = true;
        
        // Check branching conditions
        if (q.showWhen && q.showWhen.questionId) {
          const parentAnswer = answers[q.showWhen.questionId];
          isVisible = evaluateCondition(parentAnswer, q.showWhen.value);
        }

        if (isVisible) {
          // Add this question to results
          visibleResults.push(q);
          processedIds.add(qId);

          // 2. Process its NESTED follow-up questions if it has any
          if (Array.isArray(q.followUpQuestions) && q.followUpQuestions.length > 0) {
            processQuestions(q.followUpQuestions);
          }
        }
      });
    };

    processQuestions(questions);

    return visibleResults;
  };

  return {
    getOrderedVisibleQuestions,
    evaluateCondition,
  };
}
