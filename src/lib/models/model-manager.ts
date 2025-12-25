import { LocalStorage } from '@/lib/connection/LocalStorage';

export interface ModelSetting {
  modelId: string;
  provider: string;
  disabled: boolean;
  free: boolean;
  apiKey: string;
}

const MODEL_SETTINGS_STORAGE_KEY = 'model-settings';

class ModelManager {
  private static instance: ModelManager;

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  /**
   * Get all model settings from localStorage
   * @returns Array of model settings
   */
  public getModelSettings(): ModelSetting[] {
    return LocalStorage.getInstance().getAsJSON<ModelSetting[]>(
      MODEL_SETTINGS_STORAGE_KEY,
      () => []
    );
  }

  /**
   * Save model settings to localStorage
   * @param settings - Array of model settings to save
   */
  public setModelSettings(settings: ModelSetting[]): void {
    LocalStorage.getInstance().setJSON(MODEL_SETTINGS_STORAGE_KEY, settings);
  }

  /**
   * Get a specific model setting by modelId
   * @param modelId - The model ID to look up
   * @returns The model setting or undefined if not found
   */
  public getModelSetting(modelId: string): ModelSetting | undefined {
    const settings = this.getModelSettings();
    return settings.find((s) => s.modelId === modelId);
  }

  /**
   * Update a specific model setting
   * @param modelId - The model ID to update
   * @param updates - Partial updates to apply
   */
  public updateModelSetting(modelId: string, updates: Partial<Omit<ModelSetting, 'modelId'>>): void {
    const settings = this.getModelSettings();
    const index = settings.findIndex((s) => s.modelId === modelId);
    
    if (index >= 0) {
      settings[index] = { ...settings[index], ...updates };
    } else {
      // If model doesn't exist, create a new one
      settings.push({
        modelId,
        provider: '',
        disabled: false,
        free: false,
        apiKey: '',
        ...updates,
      });
    }
    
    this.setModelSettings(settings);
  }

  /**
   * Delete a model setting
   * @param modelId - The model ID to delete
   */
  public deleteModelSetting(modelId: string): void {
    const settings = this.getModelSettings();
    const filtered = settings.filter((s) => s.modelId !== modelId);
    this.setModelSettings(filtered);
  }
}

export { ModelManager };

