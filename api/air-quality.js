
export default async function handler(req, res) {
  // GitHub Pages에서 API를 호출할 수 있도록 CORS 설정
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://kesther253.github.io"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // 브라우저의 사전 요청 처리
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "허용되지 않은 요청입니다."
    });
  }

  const API_KEY = process.env.AIRKOREA_SERVICE_KEY;

  if (!API_KEY) {
    return res.status(500).json({
      error: "Vercel 환경변수에 API 키가 없습니다."
    });
  }

  const API_URL =
    "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";

  const params = new URLSearchParams({
    serviceKey: API_KEY,
    returnType: "json",
    numOfRows: "100",
    pageNo: "1",
    sidoName: "서울",
    ver: "1.0"
  });

  try {
    const response = await fetch(
      `${API_URL}?${params.toString()}`
    );

    const data = await response.json();

    if (!response.ok || !data?.response?.body?.items) {
      return res.status(502).json({
        error: "에어코리아 API 요청 실패"
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("대기질 API 오류:", error);

    return res.status(500).json({
      error: "대기질 정보를 가져오지 못했습니다."
    });
  }
}
