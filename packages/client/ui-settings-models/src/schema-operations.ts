/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Boc service schema cua settings thanh cac callback da rang buoc
 */


/**
* Hide the Cordis service identity behind bound schema callbacks.
* @param service - settings-owned schema service available in the apply context.
* @returns callbacks that cannot expose the service context to React components.
*/
export function createSettingsSchemaOperations(service: any) {
	return {
		rehydrate: (serialized: any) => service.rehydrate(serialized),
		validate: (schema: any, draft: any) => service.validate(schema, draft),
		nodeAtPath: (root: any, path: any) => service.nodeAtPath(root, path),
		getPath: (value: any, path: any) => service.getPath(value, path),
		hasPath: (value: any, path: any) => service.hasPath(value, path),
		setPath: (root: any, path: any, value: any) => service.setPath(root, path, value),
		deletePath: (root: any, path: any) => service.deletePath(root, path)
	};
}
