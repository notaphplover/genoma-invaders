module.exports = async ({ github, context, core, io }) => {
  const owner = context.repo.owner;
  const repositoryName = context.repo.repo;
  const { data: headBranch } = await github.repos.getBranch({
    owner,
    repo: repositoryName,
    branch: context.ref,
  });
  let headBranchName = headBranch.name;
  const branchSections = headBranchName.split("/");
  const indexPadding = branchSections[1].length;

  let baseBranch = null;
  let branchIndex = Number.parseInt(branchSections[1]);

  if (Number.isNaN(branchIndex)) {
    throw new Error(
      `"${headBranchName}" can not be parsed to update branch series. Checkout you "on.push.branch" property to be sure it tracks only branches with names like "foo/01" -> "foo/**"`
    );
  }

  do {
    branchIndex++;
    const formattedIndex = branchIndex.toString().padStart(indexPadding, "0");
    const baseBranchName = `${branchSections[0]}/${formattedIndex}`;

    let baseBranch;

    try {
      const response = await github.repos.getBranch({
        owner,
        repo: repositoryName,
        branch: baseBranchName,
      });

      baseBranch = response.data;
    } catch (err) {
      if (err.status && err.status === 404) {
        console.log(`Branch ${baseBranchName} not found`);
      } else {
        throw err;
      }

      baseBranch = null;
    }

    if (baseBranch) {
      console.log(`Merging ${headBranchName} into ${baseBranchName}`);

      await github.repos.merge({
        owner,
        repo: repositoryName,
        base: baseBranchName,
        head: headBranchName,
      });

      headBranchName = baseBranchName;
    }
  } while (baseBranch);

  const { data: repository } = await github.repos.get({
    owner: owner,
    repo: repositoryName,
  });

  const defaultBranchName = repository.default_branch;

  console.log(
    `Creating PR to merge ${headBranchName} into ${defaultBranchName}`
  );

  await github.pulls.create({
    owner: owner,
    repo: repositoryName,
    title: `Accumulative from "${headBranch.name}"`,
    head: headBranchName,
    base: defaultBranchName,
  });

  return `All branches after "${headBranch.name}" are up to date`;
};
