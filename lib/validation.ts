export function precisaProcessar(item: any): boolean {
  return !!(
    item.link &&
    item.link.startsWith("http") &&
    (!item.numeroNfse || item.numeroNfse === "" || item.numeroNfse === "NÃO ENCONTRADO")
  )
}