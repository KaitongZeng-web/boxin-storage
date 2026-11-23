// Only files created by Boxie are eligible for physical deletion.
export function isManagedPhoto(uri:string,root:string|null):boolean {
 if(!root||!uri.startsWith(root))return false;
 return /^(boxie-photos\/)?[a-z0-9]+-[a-z0-9]+\.jpg$/.test(uri.slice(root.length));
}
