// Creates or updates a single comment which is looked up by the workflow name.

module.exports = async (github, context, commentBody) => {
  const uniqueCommentTag = `<!-- ${context.workflow} -->`;
  commentBody = `${commentBody}\n${uniqueCommentTag}`;

  const comments = await github.rest.issues.listComments({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
  });

  const existingComment = comments.data.find((comment) =>
    comment.body.includes(uniqueCommentTag),
  );

  if (existingComment) {
    await github.rest.issues.updateComment({
      comment_id: existingComment.id,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: commentBody,
    });
  } else {
    await github.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: commentBody,
    });
  }
};
