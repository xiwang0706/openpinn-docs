WAM 梯度配点移动（``gradient_movement``）
=========================================

.. openpinn-method-summary:: adaptive_sampling gradient_movement

大白话
------

WAM 与 RAM 共用“固定一部分、移动一部分”的框架，但看的是网络解对坐标的梯度，
而不是 PDE 残差。变化陡的区域更容易获得可移动点；训练点和模型参数总数不变。

放在哪里与怎么调用
------------------

核心在 ``sampling.py``，二级入口为
``methods/adaptive_sampling/gradient_movement.py``，配置为
``configs/methods/adaptive_sampling/gradient_movement.yaml``。

.. code-block:: python

   result = op.solve(
       "poisson", method="adaptive_sampling",
       variant="gradient_movement", steps=5000,
   )

论文、代码与许可
------------------------------

依据 Hou, Li and Ying (2023)，DOI ``10.1007/s11071-023-08654-w``。
参考仓库 ``https://github.com/hsbhc/AMAW-PINN`` 未检测到明确许可证；本实现仅按
论文的梯度指标独立编写，不复制外部代码。

300 步参考短跑
--------------

普通 PINN/WAM 相对 L2 为 0.44732/0.22563，PDE 残差 RMSE 为
1.35361/1.23714，用时 0.1496/0.1373 s。WAM 完成 5 次移动，固定/移动点各 24。
完整文件在 ``results/method_expansions/20260829/adaptive_sampling/gradient_movement/``。
只说明短跑可运行且本次误差下降，不外推到其他方程或随机种子。
