// Screen registry. Each screen file default-exports a component taking { entry }.
import type React from 'react';
import type { Entry, ScreenName } from '../nav/store';
import Home from './HomeScreen';
import Learn from './BookScreen';
import Reader from './ReaderScreen';
import Search from './SearchScreen';
import Practice from './PracticeScreen';
import Workspace from './WorkspaceScreen';
import Project from './ProjectScreen';
import Terminal from './TerminalScreen';
import Editor from './EditorScreen';
import Profile from './ProfileScreen';
import Settings from './SettingsScreen';
import Account from './AccountScreen';
import Onboarding from './OnboardingScreen';

export type ScreenProps = { entry: Entry };

export const SCREENS: Record<ScreenName, React.ComponentType<ScreenProps>> = {
  home: Home, learn: Learn, reader: Reader, search: Search, practice: Practice, workspace: Workspace,
  project: Project, terminal: Terminal, editor: Editor, profile: Profile, settings: Settings,
  account: Account, onboarding: Onboarding,
};
