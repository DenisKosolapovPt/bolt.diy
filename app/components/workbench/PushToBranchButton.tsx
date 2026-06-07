import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { description } from '~/lib/persistence';
import { githubConnectionAtom } from '~/lib/stores/githubConnection';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';

interface PushToBranchButtonProps {
  gitUrl?: string;
  disabled?: boolean;
}

interface ParsedRepository {
  owner?: string;
  repoName?: string;
}

function cleanRepoName(value?: string) {
  return value
    ?.trim()
    .replace(/\s+\(fork\)$/i, '')
    .replace(/\.git$/i, '');
}

function parseRepositoryFromGitUrl(gitUrl?: string): ParsedRepository {
  if (!gitUrl) {
    return {};
  }

  const normalized = gitUrl.trim().replace(/\.git$/, '');
  const githubMatch = normalized.match(/github\.com[:/](?<owner>[^/]+)\/(?<repoName>[^/]+)$/i);

  if (!githubMatch?.groups) {
    return {};
  }

  return {
    owner: githubMatch.groups.owner,
    repoName: cleanRepoName(githubMatch.groups.repoName),
  };
}

function parseRepositoryFromDescription(value?: string): ParsedRepository {
  if (!value?.startsWith('Git Project:')) {
    return {};
  }

  const repoName = value
    .replace(/^Git Project:\s*/i, '')
    .trim()
    .split('/')
    .pop()
    ?.trim();

  return { repoName: cleanRepoName(repoName) };
}

function createBranchName(email: string, fallbackName: string) {
  const source = email.includes('@') ? email.split('@')[0] : fallbackName;
  const slug =
    source
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'user';

  return `pm/${slug}`;
}

async function fetchCloudflareEmail() {
  const response = await fetch('/api/cf-user');

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { email?: string | null };

  return data.email ?? null;
}

export function PushToBranchButton({ gitUrl, disabled }: PushToBranchButtonProps) {
  const [isPushing, setIsPushing] = useState(false);
  const connection = useStore(githubConnectionAtom);
  const chatDescription = useStore(description);

  const repository = useMemo(() => {
    const fromGitUrl = parseRepositoryFromGitUrl(gitUrl);

    if (fromGitUrl.repoName) {
      return fromGitUrl;
    }

    return parseRepositoryFromDescription(chatDescription);
  }, [chatDescription, gitUrl]);

  const handlePush = async () => {
    if (!connection.user || !connection.token) {
      toast.error('Connect GitHub before pushing changes');
      return;
    }

    if (!repository.repoName) {
      toast.error('Import a GitHub repository before pushing changes');
      return;
    }

    setIsPushing(true);

    try {
      const email = await fetchCloudflareEmail();
      const branchName = createBranchName(email ?? '', connection.user.login);
      const owner = repository.owner || connection.user.login;
      const commitMessage = `Prototype update by ${email || connection.user.login}`;
      const repoUrl = await workbenchStore.pushToRepository(
        'github',
        repository.repoName,
        commitMessage,
        owner,
        connection.token,
        undefined,
        branchName,
      );
      const branchUrl = `${repoUrl}/tree/${branchName}`;

      toast.success(
        <a href={branchUrl} target="_blank" rel="noreferrer">
          Pushed to {branchName}
        </a>,
      );
    } catch (error) {
      console.error('Failed to push prototype changes:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to push changes');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <button
      onClick={handlePush}
      disabled={disabled || isPushing}
      className={classNames(
        'rounded-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.7',
      )}
    >
      <div className={isPushing ? 'i-ph:spinner animate-spin' : 'i-ph:git-branch'} />
      {isPushing ? 'Pushing...' : 'Push to my branch'}
    </button>
  );
}
